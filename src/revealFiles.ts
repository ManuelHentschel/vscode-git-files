
import * as vscode from 'vscode';
import * as fs from 'fs';

import { getWd } from './utils';
import { reprPackIndex } from './gitFiles';
import { GIT_FILE_URI_SCHEME } from './extension';
import { listPackFiles } from './linkProvider';

// If necessary, adjust settings to show the (normally hidden) .git folder
export async function showGitFiles(notify: boolean = false) {
    interface FilesExcludeSetting {"**/.git"?: boolean}
    const config = vscode.workspace.getConfiguration();
    const isHidden = config.get<FilesExcludeSetting>('files.exclude')?.['**/.git'];
    if(!isHidden){
        return;
    }
    const setting = config.inspect<FilesExcludeSetting>('files.exclude')?.workspaceValue || {};
    setting["**/.git"] = false;
    await config.update('files.exclude', setting, vscode.ConfigurationTarget.Workspace);
    if(notify){
        vscode.window.showInformationMessage('Changed workspace settings to show .git folder.');
    }
}


// If configured to auto-reveal, reveal the specified file
export function autoRevealFile(uri: vscode.Uri): void {
    const config = vscode.workspace.getConfiguration();
    const gitfilesAutoReveal = config.get<'always' | 'inherit' | 'never'>('gitfiles.autoReveal', 'always');
    if(
        gitfilesAutoReveal === 'always'
        || (gitfilesAutoReveal === 'inherit' && config.get<boolean>('explorer.autoReveal', false))
    ){
        revealFile(uri);
    }
}

// Wrapper used by user-command
export function cmdRevealFile() {
    const uri = vscode.window.activeTextEditor?.document.uri;
    if(uri){
        revealFile(uri);
    }
}
// Reveal the "real" file, corresponding to the (possibly "virtual) uri
async function revealFile(uri: vscode.Uri): Promise<void> {
    // Reveal files that are not from this extension normally
    if(uri.scheme !== GIT_FILE_URI_SCHEME){
        revealNormalFile(uri);
        return;
    }
    if(uri.authority === 'index'){
        const wdUri = getWd();
        if(!wdUri){
            return;
        }
        const uri2 = vscode.Uri.joinPath(wdUri, '.git', 'index');
        revealNormalFile(uri2);
    } else if(uri.authority === 'pack' || uri.authority === 'packindex'){
        const uri2 = vscode.Uri.from({
            scheme: 'file',
            path: uri.path
        });
        revealNormalFile(uri2);
    } else if(uri.authority === 'sha'){
        const sha = uri.path.replace(/^\//, '');
        const uri2 = await findUriForSha(sha);
        if(uri2){
            revealNormalFile(uri2);
        } else{
            vscode.window.showWarningMessage(`Could not find source file for hash: ${sha}`);
        }
    } else{
        vscode.window.showWarningMessage(`Unknown uri: ${uri.toString()}`);
    }
}

// Once found, reveal the "real" file in the editor view
async function revealNormalFile(uri: vscode.Uri): Promise<void> {
    if(uri.scheme === 'file' && vscode.workspace.asRelativePath(uri.path).startsWith('.git')){
        await showGitFiles(true);
    }
    await vscode.commands.executeCommand('revealInExplorer', uri); // see https://github.com/microsoft/vscode/issues/94720
}

// Find the uri of the "real" file corresponding to an object name (sha)
async function findUriForSha(sha: string): Promise<vscode.Uri | undefined> {
    const looseUri = getWd('.git', 'objects', sha.slice(0,2), sha.slice(2));
    if(looseUri && fs.existsSync(looseUri.fsPath)){
        return looseUri;
    }
    const packsDir = getWd('.git', 'objects', 'pack');
    if(!packsDir){
        return undefined;
    }
    const idxUris = listPackFiles('.idx');
    if(!idxUris){
        return undefined;
    }
    for(const idxUri of idxUris){
        const shas = await listShasInPackIndex(idxUri);
        if(shas.indexOf(sha) >= 0){
            const packUri = changeFileExt(idxUri, '.pack');
            if(fs.existsSync(packUri.fsPath)){
                return packUri;
            } else{
                return undefined;
            }
        }
    }
    return undefined;
}

// Utility function to change the file extension of a uri
function changeFileExt(uri0: vscode.Uri, ext: string): vscode.Uri {
    const newPath = uri0.path.replace(/\.[^.]*$/, ext);
    const newUri = uri0.with({
        path: newPath
    });
    return newUri;
}

// Return list of object names (shas) contained in a pack index file
async function listShasInPackIndex(idxUri: vscode.Uri): Promise<string[]> {
    const txt = await reprPackIndex(idxUri.fsPath);
    const lines = txt.trim().split('\n');
    const shas = lines.map(x => x.split(/\s+/)[1]).filter(x => !!x);
    return shas;
}

