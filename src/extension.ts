
import * as vscode from 'vscode';

import { MyTextDocumentContentProvider, cmdCatFile, cmdShowPack, cmdShowPackIndex, pickAndShowSha } from './gitFiles';
import { MyDocumentLinkProvider } from './linkProvider';
import { autoRevealFile, cmdRevealFile, showGitFiles } from './revealFiles';
import { cmdShowIndex } from './viewIndex';

let outChannel: vscode.OutputChannel | undefined;

let linkProviderDispo: vscode.Disposable | undefined;

export const GIT_FILE_URI_SCHEME = 'gitfile';

export function activate(context: vscode.ExtensionContext) {

    // Create output channel to show invoked git commands
    outChannel = vscode.window.createOutputChannel('Git Files');

    // Register commands
    const commands: {[key: string]: (...args: any[]) => void} = {
        'gitfiles.showGitFiles': showGitFiles,
        'gitfiles.showPackContent': cmdShowPack,
        'gitfiles.showPackIndex': cmdShowPackIndex,
        'gitfiles.revealInExplorerView': cmdRevealFile,
        'gitfiles.parseIndexFile': cmdShowIndex,
        'gitfiles.catFile': cmdCatFile,
        'gitfiles.viewSha': pickAndShowSha
    };

    for(const [k, v] of Object.entries(commands)){
        context.subscriptions.push(vscode.commands.registerCommand(k, v));
    }

    // If configured, reveal source file on change editor
    vscode.window.onDidChangeActiveTextEditor(e => {
        if(e?.document.uri.scheme === GIT_FILE_URI_SCHEME){
            autoRevealFile(e.document.uri);
        }
    });


    // Initialize link provider, refresh on config change
    refreshLinkProvider();
    vscode.workspace.onDidChangeConfiguration(e => {
        if(e.affectsConfiguration('gitfiles')){
            refreshLinkProvider();
        }
    });

    // Register content provider for (virtual) git documents
    vscode.workspace.registerTextDocumentContentProvider(GIT_FILE_URI_SCHEME, new MyTextDocumentContentProvider());
}

// Helper function to write to output channel
export function writeOutput(...parts: string[]){
    outChannel?.appendLine(parts.join(''));
}

// Re-register link provider, in case the `gitfiles.showAlways` settings has changed
function refreshLinkProvider() {
    const linkProvider = new MyDocumentLinkProvider();
    let docSelector: vscode.DocumentSelector;
    const config = vscode.workspace.getConfiguration('gitfiles');
    if(config.get<boolean>('showAlways', false)){
        docSelector = '*';
    } else{
        docSelector = [
            {scheme:GIT_FILE_URI_SCHEME},
            {pattern: '**/.git/**/*'}
        ];
    }
    linkProviderDispo?.dispose();
    linkProviderDispo = vscode.languages.registerDocumentLinkProvider(docSelector, linkProvider);
    return linkProviderDispo;
}
