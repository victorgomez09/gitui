import { takeEvery, take, put, select, race } from 'redux-saga/effects'
import { eventChannel } from 'redux-saga'

import { Git } from '../../lib/git'
import { CWD_UPDATED } from '../config/actions'
import { gitRefsChanged } from './actions'
import { CORE_INIT } from '../core/actions'

function* listenForRefChanges() {
  const cwd = yield select((state) => state.config.cwd)
  const git = new Git(cwd)

  const refChangeEmitter = eventChannel((emit) => {
    return git.watchRefs((data) => {
      emit(data)
    })
  })

  while (true) {
    const { changed, cancel } = yield race({
      changed: take(refChangeEmitter),
      cancel: take(CWD_UPDATED),
    })

    if (cancel) {
      break
    }

    const { showRemoteBranches } = yield select((state) => state.config)

    const { ref, isRemote } = changed
    if (isRemote && !showRemoteBranches) {
      // Hasn't actually changed visibly
      continue
    }

    yield put(gitRefsChanged(ref, isRemote))
  }
}

export function* watch() {
  yield takeEvery([CORE_INIT, CWD_UPDATED], listenForRefChanges)
}
