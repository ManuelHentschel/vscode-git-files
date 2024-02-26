
import * as cp from 'child_process';
import * as process from 'process';
import * as vscode from 'vscode';

import { writeOutput } from './extension';

// Helper function to get the uri of the currently open workspace
// Not compatible with multi-folder workspaces!
// Optionally specify relative path segments inside the workspace
export function getWd(...pathSegments: string[]): vscode.Uri | undefined {
    const uri = vscode.workspace.workspaceFolders?.[0]?.uri;
    if(!uri){
        return undefined;
    }
    return vscode.Uri.joinPath(uri, ...pathSegments);
}

// On windows, use `type` instead of `cat`
export function catCommand(): string {
    if(process.platform === 'win32'){
        return 'type';
    }
    return 'cat';
}


// Custom version of cp.exec that specifies the wd, and logs the command and possible error
export interface ExecReturn {
    error: cp.ExecException | null,
    stdout: string,
    stderr: string
}
export async function myExec(command: string, options?: cp.ExecOptions): Promise<ExecReturn> {
    const optionsWithEncoding: cp.ExecOptionsWithStringEncoding = {
        encoding: 'utf-8',
        cwd: getWd()?.fsPath,
        ...options
    };
    if(!optionsWithEncoding.cwd){
        throw new Error('Extension only works with an opened workspace folder!');
    }
    writeOutput(`CMD: ${command}`);
    const ret = await new Promise<ExecReturn>((resolve, reject) => {
        cp.exec(command, optionsWithEncoding, (error, stdout, stderr) => {
            resolve({
                error,
                stdout,
                stderr
            });
        });
    });
    if(ret.error){
        writeOutput(`ERROR ${ret.error.code ?? '?'}: ${ret.error.message}`);
    }
    return ret;
}

