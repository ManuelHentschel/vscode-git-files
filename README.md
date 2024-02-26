
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

Most of the contents of the index file `.git/index`, i.e. the state of the index,
can be shown using the command `ls-files --stage`.
Since this file is quite central to git,
an effort has been made to also parse its binary contents,
based on the information available on https://git-scm.com/docs/index-format.
The command `"gitfiles.parseIndexFile"` shows a representation of the
index file similar to the following example.
```
// Pattern: HEX // [interpretation //] comment
44 49 52 43 // "DIRC" // Signature
00 00 00 02 // 2 // Version
00 00 00 04 // 4 // Number of index entries


// Index entries:
61 C0 7E F3 // 1640005363 // Creation timestamp (seconds)
0F F7 99 00 // 267884800 // Creation timestamp (nanoseconds)
61 C0 7E F6 // 1640005366 // Modification timestamp (seconds)
2B 3E C0 80 // 725532800 // Modification timestamp (nanoseconds)
00 00 00 00 // dev
00 00 00 00 // ino
00 00 81 A4 // mode
00 00 00 00 // uid
00 00 00 00 // gid
00 00 00 0D // 13 // file size
9D 8B A3 E9 39 F5 24 79 73 72 9C CE 39 62 9D 51 BE 83 88 3E // 9d8ba3e939f5247973729cce39629d51be83883e // object name (hash)
00 0A // 00000000 00001010 // flags
2E 67 69 74 69 67 6E 6F 72 65 00 00 00 00 00 00 00 00 // ".gitignore" // Relative file path
...
```
Here, the numbers are the hexadecimal representation of the file contents.
Comments start with `//` and contain an interpretation of the corresponding
bytes as numbers, strings, or binary,
as well as an explanation what they represent.

*Note:* This command was only tested with git v2.43 on windows,
results might/will vary with different setups.
