
import * as path from 'path';
import * as vscode from 'vscode';

import { GIT_FILE_URI_SCHEME } from './extension';
import { catCommand, myExec } from './utils';
import { reprIndex } from './viewIndex';
import { getShas } from './linkProvider';

// Class that actually provides the contents for virtual documents
export class MyTextDocumentContentProvider implements vscode.TextDocumentContentProvider {
    async provideTextDocumentContent(uri: vscode.Uri, token: vscode.CancellationToken): Promise<string | undefined> {
        const path = uri.path.replace(/^\//, '');
        if(uri.authority === 'sha'){
            return reprSha(path);
        } else if(uri.authority === 'index'){
            return reprIndex(uri.path);
        } else if(uri.authority === 'pack'){
            return reprPack(path);
        } else if(uri.authority === 'packindex'){
            return reprPackIndex(path);
        }
        return undefined;
    }
}

// Wrapper for the user-command
export function cmdShowPack(fileUri: vscode.Uri | unknown){
    if(fileUri instanceof vscode.Uri){
        showPack(fileUri);
    }
}
// Show the contents of a .pack file
function showPack(fileUri: vscode.Uri){
    const packUri = vscode.Uri.from({
        scheme: GIT_FILE_URI_SCHEME,
        authority: 'pack',
        path: fileUri.path
    });
    vscode.window.showTextDocument(packUri);
}
// Get the actual text representation of a .pack file
async function reprPack(fsPath: string): Promise<string> {
    const relPath = vscode.workspace.asRelativePath(fsPath);
    const cmd = `git verify-pack -v ${relPath}`;
    const ret = await myExec(cmd);
    if(ret.error){
        vscode.window.showWarningMessage(`Error ${ret.error.code}: ${ret.error.message}`);
        throw new Error(`Error ${ret.error.code}: ${ret.error.message}`);
    }
    return ret.stdout;
}


// Wrapper for the user-command
export function cmdShowPackIndex(fileUri: vscode.Uri){
    if(fileUri instanceof vscode.Uri){
        showPackIndex(fileUri);
    }
}
// Show the contents of a .idx (pack-index) file
async function showPackIndex(fileUri: vscode.Uri){
    const packIndexUri = vscode.Uri.from({
        scheme: GIT_FILE_URI_SCHEME,
        authority: 'packindex',
        path: fileUri.path
    });
    vscode.window.showTextDocument(packIndexUri);
}
// Get the actual text representation of a .idx file
export async function reprPackIndex(fsPath: string): Promise<string> {
    const relPath = path.normalize(vscode.workspace.asRelativePath(fsPath));
    const cmd = `${catCommand()} "${relPath}" | git show-index`;
    const ret = await myExec(cmd);
    if(ret.error){
        vscode.window.showWarningMessage(`Error ${ret.error.code}: ${ret.error.message}`);
        throw new Error(`Error ${ret.error.code}: ${ret.error.message}`);
    }
    return ret.stdout;
}


// Wrapper for the user-command
export function cmdCatFile(uri?: vscode.Uri | unknown){
    if(uri === undefined){
        uri = vscode.window.activeTextEditor?.document.uri;
    }
    if(uri instanceof vscode.Uri){
        catFile(uri);
    }
}
// (Attempt to) show contents of a file. Can be either a git object file itself or a tracked file.
async function catFile(uri: vscode.Uri){
    const relPath = vscode.workspace.asRelativePath(uri.fsPath);
    const m = /.git\/objects\/([0-9a-f]{2})\/([0-9a-f]+)/.exec(relPath);
    if(m){
        const sha = m[1] + m[2];
        showSha(sha);
        return;
    }
    const sha = await getShaOfFile(uri);
    if(sha){
        showSha(sha);
        return;
    }
    vscode.window.showInformationMessage(`Not a git object path: ${relPath}`);
    return;
}
// Get the object name (sha) of a "real" file
async function getShaOfFile(uri: vscode.Uri): Promise<string | undefined> {
    const relPath = vscode.workspace.asRelativePath(uri);
    const cmd = `git ls-files --format "%(objectname)" ${relPath}`;
    const ret = await myExec(cmd);
    const m = /^[0-9a-f]+/.exec(ret.stdout);
    if(ret.error || !m){
        return undefined;
    }
    const sha = m[0];
    return sha;
}

// Display list of SHAs and show the one picked by the user
export async function pickAndShowSha() {
    const shas = await getShas();
    const sha = await vscode.window.showQuickPick(shas);
    if(sha){
        showSha(sha);
    }
}

// Show the contents of a file specified by object name (sha)
function showSha(sha: string){
    const uri = vscode.Uri.from({
        scheme: GIT_FILE_URI_SCHEME,
        authority: 'sha',
        path: `/${sha}`
    });
    vscode.window.showTextDocument(uri);
}
// Actually get the contents of a file specified by object name (sha)
async function reprSha(sha: string): Promise<string> {
    const cmd = `git cat-file -p ${sha}`;
    const ret = await myExec(cmd);
    if(ret.error){
        throw new Error(`Error ${ret.error.code}: ${ret.error.message}`);
    }
    return ret.stdout;
}
