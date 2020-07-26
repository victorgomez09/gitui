import React, {
  useState,
  useMemo,
  useEffect,
  useLayoutEffect,
  useRef,
  useCallback,
} from 'react'
import PropTypes from 'prop-types'
import { useSelector, useDispatch } from 'react-redux'
import styled from 'styled-components'
import _ from 'lodash'

import * as XTerm from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { WebLinksAddon } from 'xterm-addon-web-links'
import { spawn } from 'node-pty'

import { shell } from 'electron'
import { exec } from 'child_process'

import { terminalChanged } from 'app/store/terminal/actions'
import { INITIAL_CWD } from 'app/lib/cwd'
import { BASHRC_PATH } from './bash-config'

const terminalOpts = {
  allowTransparency: true,
  fontFamily: 'Inconsolata, monospace',
  fontSize: 16,
  theme: {
    background: 'rgba(255, 255, 255, 0)',
  },
  cursorStyle: 'bar',
}

export function Terminal({ onAlternateBufferChange }) {
  const dispatch = useDispatch()
  const container = useRef()

  const cwd = useSelector((state) => state.config.cwd) || INITIAL_CWD
  const cwdStaticRef = useRef(cwd)

  const { fullscreen } = useSelector((state) => state.terminal)

  const [alternateBuffer, setAlternateBuffer] = useState(false)
  const [focused, setFocused] = useState(false)

  const ptyProcess = useMemo(() => {
    // TODO: integrate user preferences into this. Allow for (or bundle?) git-bash on windows
    const shell = '/bin/bash' //process.env[os.platform() === 'win32' ? 'COMSPEC' : 'SHELL']
    const ptyProcess = spawn(shell, ['--noprofile', '--rcfile', BASHRC_PATH], {
      name: 'xterm-color',
      cwd: cwdStaticRef.current,
      env: {
        ...process.env,
        GITERM_RC: BASHRC_PATH,
      },
    })

    return ptyProcess
  }, [])

  const [terminal, fit] = useMemo(() => {
    const terminal = new XTerm.Terminal(terminalOpts)
    const fit = new FitAddon()

    const weblinks = new WebLinksAddon((ev, uri) => {
      if (ev.metaKey) {
        shell.openExternal(uri)
      }
    })

    terminal.loadAddon(fit)
    terminal.loadAddon(weblinks)

    return [terminal, fit]
  }, [])
  useEffect(() => {
    terminal.open(container.current)
  }, [terminal])

  const handleResizeTerminal = useCallback(() => {
    terminal.resize(10, 10)
    fit.fit()
    terminal.focus()
  }, [fit, terminal])
  useLayoutEffect(() => {
    setTimeout(() => {
      handleResizeTerminal()
    }, 0)
  }, [fullscreen, handleResizeTerminal, terminal.element])

  // Resize terminal based on window size changes
  useEffect(() => {
    const handleResize = _.debounce(handleResizeTerminal, 5)

    window.addEventListener('resize', handleResize, false)

    const onResizeDisposable = terminal.onResize(
      _.throttle(({ cols, rows }) => {
        ptyProcess.resize(cols, rows)
      }, 5),
    )

    return () => {
      window.removeEventListener('resize', handleResize)
      onResizeDisposable.dispose()
    }
  }, [handleResizeTerminal, ptyProcess, terminal])

  // Integrate terminal and pty processes
  useEffect(() => {
    const updateAlternateBuffer = _.debounce((active) => {
      // ensure xterm has a few moments to trigger its
      // own re-render before we trigger a resize
      setTimeout(() => {
        setAlternateBuffer(active)
        onAlternateBufferChange(active)
      }, 5)
    }, 5)

    const onDataTerminalDisposable = terminal.onData((data) => {
      ptyProcess.write(data)
    })

    const onDataPTYDisposable = ptyProcess.onData(function(data) {
      terminal.write(data)
    })

    const bufferChangeDetector = terminal.buffer.onBufferChange((buffer) => {
      updateAlternateBuffer(buffer.type == 'alternate')
    })

    return () => {
      onDataTerminalDisposable.dispose()
      onDataPTYDisposable.dispose()
      bufferChangeDetector.dispose()
    }
  }, [onAlternateBufferChange, ptyProcess, terminal])

  // Trigger app state refreshes based on terminal changes
  useEffect(() => {
    // TODO: check if lsof is on system and have alternatives in mind per platform
    const getCWD = async (pid) =>
      new Promise((resolve) => {
        exec(`lsof -p ${pid} | grep cwd | awk '{print $NF}'`, (e, stdout) => {
          if (e) {
            throw e
          }
          resolve(stdout)
        })
      })

    const dispatchTerminalChanged = _.throttle(
      () => {
        getCWD(ptyProcess.pid).then((cwd) => {
          if (!alternateBuffer) {
            dispatch(terminalChanged(cwd))
          }
        })
      },
      150,
      { leading: true, trailing: true },
    )

    const onNewLineDisposable = terminal.onKey((e) => {
      if (e.domEvent.code === 'Enter') {
        dispatchTerminalChanged()
      }
    })

    let lastProcess = ptyProcess.process
    const onProcessChangedDisposable = ptyProcess.onData(function() {
      const processChanged = lastProcess !== ptyProcess.process
      if (processChanged) {
        lastProcess = ptyProcess.process
        dispatchTerminalChanged()
      }
    })

    return () => {
      onNewLineDisposable.dispose()
      onProcessChangedDisposable.dispose()
    }
  }, [alternateBuffer, dispatch, ptyProcess, ptyProcess.pid, terminal])

  // Ensure typing always gives focus to the terminal
  useEffect(() => {
    const handleNotFocused = () => {
      if (!focused) {
        terminal.focus()
      }
    }

    terminal.textarea.onblur = () => setFocused(false)
    terminal.onfocus = () => setFocused(true)
    window.addEventListener('keydown', handleNotFocused)

    return () => {
      window.removeEventListener('keydown', handleNotFocused)
    }
  }, [focused, terminal])

  // // TODO: ensure the process can't be exited and restart if need be
  // that.ptyProcess.on('exit', () => {
  //   console.log('recreating')
  //   that.setupXTerm()
  //   that.setupTerminalEvents()
  // })

  return <TerminalContainer ref={container} />
}

Terminal.propTypes = {
  onAlternateBufferChange: PropTypes.func.isRequired,
}

const TerminalContainer = styled.div`
  display: flex;
  flex: 1;
  margin: 5px;
`
