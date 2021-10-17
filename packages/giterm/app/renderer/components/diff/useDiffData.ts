import { useMemo, useState, useEffect, useCallback } from 'react'
import { useSelector, useDispatch } from 'app/store'
import { Git, DiffResult, DiffFile, FileText } from '@giterm/git'

import { diffFileSelected } from 'app/store/diff/actions'
import { setWindowTitle } from 'app/lib/title'

export type { FileText }

export interface DiffData {
  loading: boolean
  filePath: string
  setFilePath: (path: string) => void
  diff: DiffResult | null
  left: FileText | null
  right: FileText | null
}

export function useDiffData({ contextLines = 5 } = {}): DiffData {
  const dispatch = useDispatch()
  const cwd = useSelector((state) => state.config.cwd)
  const {
    mode,
    shas: [shaNew, shaOld = null] = [],
    filePath: _filePath,
  } = useSelector((state) => state.diff)

  const setFilePath = useCallback(
    (filePath) => {
      dispatch(diffFileSelected(filePath))
    },
    [dispatch],
  )

  const [loading, setLoading] = useState(true)
  const [diff, setDiff] = useState<DiffResult | null>(null)
  const [left, setLeft] = useState<FileText | null>(null)
  const [right, setRight] = useState<FileText | null>(null)
  useEffect(() => {
    let cancelled = false

    async function fetchDiff() {
      const git = new Git(cwd)

      const diff =
        mode === 'shas'
          ? await git.diff.getDiffFromShas(shaNew, shaOld, {
              contextLines,
            })
          : await git.diff.getDiffFromIndex({ contextLines })

      if (!cancelled) {
        if (diff) {
          setDiff(diff)
        }

        setLoading(false)
      }
    }

    fetchDiff()

    return () => {
      cancelled = true
    }
  }, [contextLines, cwd, mode, shaNew, shaOld])

  const fileDiff = useMemo<DiffFile | null>(() => {
    if (_filePath) {
      const fileDiff = diff?.files?.find(
        (patch) => (patch.newName ?? patch.oldName) === _filePath,
      )
      return fileDiff ?? null
    } else {
      return diff?.files[0] ?? null
    }
  }, [_filePath, diff?.files])

  const fileName = _filePath || fileDiff?.newName || fileDiff?.oldName || ''

  useEffect(() => {
    if (!fileDiff) {
      return
    }

    let cancelled = false

    const leftName = fileDiff.oldName
    const rightName = fileDiff.newName

    async function fetch() {
      const git = new Git(cwd)

      let left: FileText | null
      let right: FileText | null
      if (mode === 'shas') {
        const shaOldRelative = shaOld ?? `${shaNew}~1`
        left = await git.getFilePlainText(leftName, shaOldRelative)
        right = await git.getFilePlainText(rightName, shaNew)
      } else {
        left = await git.getFilePlainText(leftName, 'HEAD')
        right = await git.getFilePlainText(rightName)
      }

      if (!cancelled) {
        if (left && right) {
          setLeft(left)
          setRight(right)
        }

        setLoading(false)
      }
    }

    fetch().catch((e) => {
      console.warn(e)
    })

    return () => {
      cancelled = true
    }
  }, [cwd, fileDiff, mode, shaNew, shaOld])

  useEffect(() => {
    const oldName = fileDiff?.oldName
    const newName = fileDiff?.newName

    const isRenamed = oldName !== newName

    let title: string
    if (isRenamed) {
      if (oldName && newName) {
        title = `${oldName} -> ${newName}`
      } else if (oldName) {
        title = `${oldName} (deleted)`
      } else {
        title = `${newName} (created)`
      }
    } else {
      title = `${newName ?? oldName ?? ''}`
    }

    return setWindowTitle(title)
  }, [fileDiff?.newName, fileDiff?.oldName])

  return {
    loading,
    filePath: fileName,
    setFilePath,
    diff,
    left,
    right,
  }
}
