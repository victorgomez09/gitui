/**
 * @type {import('nodegit')}
 */
let NodeGit = global.nodegit
if (!NodeGit) {
  NodeGit = require('nodegit')
  global.nodegit = NodeGit
}

async function getIndexDiff() {
  const repo = await NodeGit.Repository.open('.')

  // FULL INDEX TO COMMIT DIFF
  const head = await repo.getHeadCommit()
  const diff = await NodeGit.Diff.treeToWorkdirWithIndex(
    repo,
    await head.getTree(),
  )

  console.log(JSON.stringify(await unwrapFuncs(diff), null, 2))
}

async function getCommitsDiff() {
  const repo = await NodeGit.Repository.open('.')

  const sha1 = '529bbb2e074ed0cdd5fba316546eeb54704e1d37'
  const sha2 = 'bc546e06e8b7e4b561b5b859acb97e0f809eaaaf'

  // FULL COMMIT TO COMMIT DIFF
  const c1 = await (await repo.getCommit(sha1)).getTree()
  const c2 = await (await repo.getCommit(sha2)).getTree()

  const diff = await NodeGit.Diff.treeToTree(repo, c1, c2)
  console.log(JSON.stringify(await unwrapFuncs(diff), null, 2))
}

async function unwrapFuncs(obj) {
  if (obj.tostrS) {
    return obj.tostrS()
  }

  if (Array.isArray(obj)) {
    return Promise.all(obj.map(unwrapFuncs))
  }

  return await Object.keys(Object.getPrototypeOf(obj)).reduce(
    async (_aggr, key) => {
      const aggr = await _aggr

      async function getValue() {
        if (typeof obj[key] === 'function') {
          const value = await Promise.resolve((async () => obj[key]())()).catch(
            (e) => `Key err: ${key}: ${e}`,
          )
          if (typeof value === 'object') {
            return await unwrapFuncs(value)
          }
          return value
        } else {
          return obj[key]
        }
      }

      aggr[key] = await getValue()

      return aggr
    },
    {},
  )
}

// getIndexDiff()
getCommitsDiff()
