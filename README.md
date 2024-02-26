
# View internal git files

This extension helps making sense of the files in the (hidden) `.git` folder.
It is primarily intended as a tool to help understanding the inner workings of git,
not as a tool to be useful in actual git manipulations.
The provided commands are readonly and do not affect the state of the repo.

This extension is not an interactive tutorial,
please refer e.g. to https://git-scm.com/book/en/v2/Git-Internals-Plumbing-and-Porcelain
for actual explanations.

## Commands
This extension makes following an article like the one linked above easier
by providing the following commands/features:

- `"gitfiles.showGitFiles"` reveals the hidden `.git` folder if necessary.
- `"gitfiles.viewSha"` displays a list of all object names (hashes) and shows
the contents of the selected one.
- `"gitfiles.catFile"` can be called from the context menu of files.
For files in `.git/objects/`, it shows their contents using `git cat-file`.
For other files, it tries to find the corresponding index entry using `git ls-files`
and shows its contents.
- `"gitfiles.showPackContent"` and `"gitfiles.showPackIndex"` can be called from the
context menu of `.pack` and `.idx` files in `.git/objects/pack` and lists their content
using `git verify-pack` and `git show-index`.
- `"gitfiles.revealInExplorerView"` reveals the currently open (git) file in the explorer view.
For virtual files generated using the commands above, it reveals the corresponding "source file".
- `"gitfiles.parseIndexFile"` attempts to parse the `.git/index` file.
See below for details.

## Hyperlinks
Where sensible, the extension provides hyperlinks to other git related files.
Depending on the target, these open either virtual files or real files.

## Output channel
To illustrate what is going on in the background,
the output channel `Git Files`,
contains all the git commands that are run to provide the displayed information.

*Note:* The command `git rev-list --all --objects --no-object-names`
is run everytime a document is opened in order get the full list of hashes
in the repository (possible targets for hyperlinks).

## Configuration
- `"gitfiles.alwaysShowCommands"` can be set to `true` to always show context menu entries
and hyperlinks, not just for files where they are expected.
This can be used e.g. if files were manually moved from the `.git` folder for comparison.
- `"gitfiles.autoReveal"` conigures whether the extension automatically reveals
the "source file" of selected virtual documents.

## The `.git/index` file

// TODO

