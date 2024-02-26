
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

import { GIT_FILE_URI_SCHEME } from './extension';
import { getWd, myExec } from './utils';


// Provide clickable links in git files that reference other git files/objects
export class MyDocumentLinkProvider implements vscode.DocumentLinkProvider {
    async provideDocumentLinks(document: vscode.TextDocument, token: vscode.CancellationToken): Promise<vscode.DocumentLink[] | undefined> {
        // Avoid infinite loop from output channel of this extension
        if(document.uri.scheme === 'output'){
            return [];
        }
        // Abort if no .git folder exists
        const gitFolder = getWd('.git')?.fsPath;
        if(!gitFolder){
            return [];
        }

        const txt = document.getText();
        const ret: vscode.DocumentLink[] = [];

        // Provide links for shas present in the repo
        const shas = await getShas();
        if(token.isCancellationRequested){
            return undefined;
        }
        for(const sha of shas){
            const matches = [...txt.matchAll(new RegExp(sha, 'g'))];
            const indices = matches.map(v => v.index ?? -1).filter(v => v>=0);
            const len = sha.length;
            const uri = vscode.Uri.from({
                scheme: GIT_FILE_URI_SCHEME,
                authority: 'sha',
                path: `/${sha}`
            });
            ret.push(...indices.map(i => {
                const rng = new vscode.Range(document.positionAt(i), document.positionAt(i+len));
                return new  vscode.DocumentLink(rng, uri);
            }));
        }
        
        // Provide links for references to .git/refs/heads and .git/refs/tags
        const pathMatches = [...txt.matchAll(/(refs\/(?:heads|tags)\/.*)/g)];
        for(const match of pathMatches){
            const mPath = path.join(gitFolder, match[1]);
            const i = match.index ?? -1;
            if(fs.existsSync(mPath) && i>=0){
                const len = mPath.length;
                const uri = vscode.Uri.file(mPath);
                const rng = new vscode.Range(document.positionAt(i), document.positionAt(i+len));
                ret.push(new vscode.DocumentLink(rng, uri));
            }
        }
        
        // Provide links for references to pack files in .git/objects/pack
        const packFiles = listPackFiles('.pack');
        for(const packFile of packFiles || []){
            const bn = path.basename(packFile.path);
            const matches = [...txt.matchAll(new RegExp(bn, 'g'))];
            const indices = matches.map(v => v.index ?? -1).filter(ind => ind>=0);
            const len = bn.length;
            const uri = vscode.Uri.from({
                scheme: GIT_FILE_URI_SCHEME,
                authority: 'pack',
                path: packFile.path
            });
            ret.push(...indices.map(i => {
                const rng = new vscode.Range(document.positionAt(i), document.positionAt(i+len));
                return new  vscode.DocumentLink(rng, uri);
            }));
        }
        return ret;
    }
}


// Get list of all object names (shas) in the repo
export async function getShas(): Promise<string[]> {
    const cmd = 'git rev-list --all --objects --no-object-names';
    const ret = await myExec(cmd);
    if(ret.error){
        vscode.window.showWarningMessage(`Error ${ret.error.code} while listing SHAs: ${ret.error.message}`);
        return [];
    }
    const shas = ret.stdout.trim().split('\n');
    return shas;
}


// Return list of pack (or pack-index) files in the repo
export function listPackFiles(ext: string = '.idx'): undefined | vscode.Uri[] {
    const packsDir = getWd('.git', 'objects', 'pack');
    if(!packsDir){
        return undefined;
    }
    let allPacks = fs.readdirSync(packsDir.fsPath);
    if(ext){
        allPacks = allPacks.filter(x => x.endsWith(ext));
    }
    const packUris = allPacks.map(x => vscode.Uri.joinPath(packsDir, x));
    return packUris;
}
