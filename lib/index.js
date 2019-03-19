const spawn = require('cross-spawn').sync

// ensure git support
const child = spawn('git')
const error = child.stderr.toString().trim()
if (error) throw new Error(error)

const SEPARATOR = '@@__GIT_LOG_SEP__@@'

function defaultFormatter (timestamp, lang) {
  return new Date(Number(timestamp) * 1000).toLocaleString(lang)
}

module.exports = (options = {}, context) => {
  const {
    formatTime = defaultFormatter,
    additionalProps = {},
  } = options

  let { additionalArgs = [] } = options
  if (typeof additionalArgs === 'string') {
    additionalArgs = additionalArgs.split(/ +/g)
  }

  const PropList = Object.entries({
    fullHash: '%H',
    authorTime: '%at',
    commitTime: '%ct',
    authorName: '%an',
    ...additionalProps,
  })

  const template = PropList.map(([_, abbr]) => abbr).join(SEPARATOR)

  function getProps (info) {
    const result = {}
    info.split(SEPARATOR).forEach((value, index) => {
      result[PropList[index][0]] = value
    })
    return result
  }

  return {
    extendPageData ($page) {
      if (!$page._filePath) return
      try {
        const { $lang } = $page._computed
        const child = spawn('git', [
          'log',
          `--format=${template}`,
          ...additionalArgs,
          $page._filePath,
        ])
        if (child.stderr.toString().trim()) return
        const commits = child.stdout.toString().trim().split(/\r?\n/g).map(getProps)
        if (!commits.length) return

        $page.git = {
          commits,
          created: formatTime(commits[0].authorTime, $lang),
          updated: formatTime(commits[commits.length - 1].commitTime, $lang),
          author: commits[0].authorName,
          contributors: Array.from(new Set(commits.map(c => c.authorName))),
        }
      } catch (e) {}
    },
  }
}
