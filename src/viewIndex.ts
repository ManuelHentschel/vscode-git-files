
import * as vscode from 'vscode';

import { GIT_FILE_URI_SCHEME } from "./extension";
import { getWd } from "./utils";

// The index file is parsed on a best-effort basis.
// Information about the file structure is from https://git-scm.com/docs/index-format.
// The parsing was tested on windows with git v2.43 and might/will break in other setups.


type bytes = number[]; // bytes are represented by number arrays, implicitly containing integer numbers 0-255

interface ParsedIndex {
    signature: bytes; // 4 bytes, "DIRC" -> else: split index etc. -> ???
    version: bytes; // 4 bytes
    nIndexEntries: bytes; // 32
    indexEntries: IndexEntry[]; // nIndexEntires
    extensions: ExtensionEntry[]; // unknown length. always present?
    hash: bytes; // 160/256/unknown
}

interface IndexEntry {
    // Entry lengths specified in bits
    ctimeSeconds: bytes; // 32
    ctimeNanos: bytes; // 32
    mtimeSeconds: bytes; // 32
    mtimeNanos: bytes; // 32
    dev: bytes; // 32
    ino: bytes; // 32
    mode: bytes; // 32 (split into ???)
    uid: bytes; // 32
    gid: bytes; // 32
    fileSize: bytes; // 32
    objectName: bytes; // ??, nul-termianted
    flags: bytes; // 16 (contains `extended` flag)
    v3Flags?: bytes; // 16, only if `extended`, (split into ...)
    name: bytes; // ??, nul-terminated    
}

interface ExtensionEntry {
    signature: bytes; // 4 bytes
    size: bytes; // 32
    body: bytes; // size
}


// Wrapper for user-command
export function cmdShowIndex(uri?: vscode.Uri | unknown) {
    if(uri instanceof vscode.Uri){
        showIndex(uri);
    } else{
        showIndex();
    }
}
// Show contents of the/an index file
export async function showIndex(uri0?: vscode.Uri){
    const path = uri0?.path || getWd('.git', 'index')?.path;
    const uri = vscode.Uri.from({
        scheme: GIT_FILE_URI_SCHEME,
        authority: 'index',
        path: path
    });
    const editor = await vscode.window.showTextDocument(uri);
    vscode.languages.setTextDocumentLanguage(editor.document, 'parsedGitIndex');
}
// Actually get text representation of index file
export async function reprIndex(path?: string): Promise<string | undefined> {
    const indexBytes = await readIndexFile(path);
    if(!indexBytes){
        return undefined;
    }
    const indexContents = parseIndex(indexBytes);
    return reprParsedIndex(indexContents);
}

// Read the binary contents of an index file, or .git/index
export async function readIndexFile(path0?: string): Promise<Uint8Array | undefined> {
    let indexUri: vscode.Uri | undefined;
    if(path0){
        indexUri = vscode.Uri.from({
            scheme: 'file',
            path: path0
        });
    } else{
        indexUri = getWd('.git', 'index');
        if(!indexUri){
            return undefined;
        }
    }
    const content = await vscode.workspace.fs.readFile(indexUri);
    return content;
}


// // Functions that actually parse the bytes of an index file
export function parseIndex(bytes: Uint8Array): ParsedIndex {
    const numbers: number[] = [];
    for(const x of bytes){
        numbers.push(x);
    }
    // Get header
    const signature = numbers.splice(0, 4);
    const version = numbers.splice(0, 4);
    const nIndexEntries = numbers.splice(0, 4);
    const indexEntries: IndexEntry[] = [];
    for(let i = 0; i < bytesToNumber(nIndexEntries); i++) {
        indexEntries.push(parseIndexEntry(numbers));
        if(numbers.length === 0){
            vscode.window.showWarningMessage('Unexpected end of file while reading index entries!');
            break;
        }
    }
    const extensionEntries: ExtensionEntry[] = [];
    // eslint-disable-next-line no-constant-condition
    while(true){
        const ext = parseExtensionEntry(numbers);
        if(!ext){
            break;
        }
        extensionEntries.push(ext);
    }
    const hash = [...numbers];
    const ret: ParsedIndex = {
        signature: signature,
        version: version,
        nIndexEntries: nIndexEntries,
        indexEntries: indexEntries,
        extensions: extensionEntries,
        hash: hash
    };
    return ret;
}

function parseIndexEntry(bytes: number[]): IndexEntry {
    const len0 = bytes.length;
    const ret: IndexEntry = {
        ctimeSeconds: bytes.splice(0, 4), // 32
        ctimeNanos: bytes.splice(0, 4), // 32
        mtimeSeconds: bytes.splice(0, 4), // 32
        mtimeNanos: bytes.splice(0, 4), // 32
        dev: bytes.splice(0, 4), // 32
        ino: bytes.splice(0, 4), // 32
        mode: bytes.splice(0, 4), // 32 (split into ???)
        uid: bytes.splice(0, 4), // 32
        gid: bytes.splice(0, 4), // 32
        fileSize: bytes.splice(0, 4), // 32
        objectName: bytes.splice(0, 20), // 20??
        flags: bytes.splice(0, 2), // 16 (contains `extended` flag)
        v3Flags: undefined, // 16, only if `extended`, (split into ...)
        name: [], // ??, nul-terminated    
    };
    const extended = ret.flags[0] & 2**7; // second bit in first byte
    if(extended){
        ret.v3Flags = bytes.splice(0, 2);
    }
    const len1 = bytes.length;
    const remainder = ((len1 - len0) % 8 + 8) % 8; // make sure the remainder is >= 0
    ret.name.push(...bytes.splice(0, remainder));
    // eslint-disable-next-line no-constant-condition
    while(true){
        const part = bytes.splice(0, 8);
        ret.name.push(...part);
        if(part.length < 8){
            vscode.window.showWarningMessage('Unexpected length of index entry bytes while reading file name!');
            break;
        }
        if(part[7] === 0){
            break;
        }
    }
    return ret;
}

function parseExtensionEntry(bytes: number[]): ExtensionEntry | undefined {
    if(bytes.length < 8){
        return undefined;
    }
    const signature = bytes.slice(0, 4);
    const size = bytes.slice(4, 8);
    const nSize = bytesToNumber(size);
    if(nSize > bytes.length){
        return undefined;
    }
    bytes.splice(0, 8); // ignore because we already copied to signature/size
    const body = bytes.splice(0, nSize);
    return {
        signature: signature,
        size: size,
        body: body
    };
}

// // Functions to convert a parsed index file to text
function reprParsedIndex(cnt: ParsedIndex): string {
    const lines: (string | number)[] = [];
    lines.push(
        '// Pattern: HEX // [interpretation //] comment',
        makeLine(cnt.signature, 'string', 'Signature'),
        makeLine(cnt.version, 'number', 'Version'),
        makeLine(cnt.nIndexEntries, 'number', 'Number of index entries'),
        '',
        '',
        '// Index entries:'
    );
    for(const entry of cnt.indexEntries){
        lines.push(...reprIndexEntry(entry));
        lines.push('');
    }
    lines.push(
        '',
        '// Extensions:'
    );
    for(const ext of cnt.extensions){
        lines.push(...reprExtensionEntry(ext));
        lines.push('');
    }
    lines.push(
        '',
        makeLine(cnt.hash, 'hex', `Hash of index file so far (${cnt.hash.length} bytes)`),
        ''
    );
    return lines.join('\n');
}

function reprIndexEntry(cnt: IndexEntry): (string|number)[] {
    const lines: (string | number)[] = [];
    lines.push(
        makeLine(cnt.ctimeSeconds, 'number', 'Creation timestamp (seconds)'),
        makeLine(cnt.ctimeNanos, 'number', 'Creation timestamp (nanoseconds)'),
        makeLine(cnt.mtimeSeconds, 'number', 'Modification timestamp (seconds)'),
        makeLine(cnt.mtimeNanos, 'number', 'Modification timestamp (nanoseconds)'),
        makeLine(cnt.dev, 'HEX', 'dev'),
        makeLine(cnt.ino, 'HEX', 'ino'),
        makeLine(cnt.mode, 'HEX', 'mode'),
        makeLine(cnt.uid, 'HEX', 'uid'),
        makeLine(cnt.gid, 'HEX', 'gid'),
        makeLine(cnt.fileSize, 'number', 'file size'),
        makeLine(cnt.objectName, 'hex', 'object name (hash)'),
        makeLine(cnt.flags, 'binary', 'flags')
    );
    if(cnt.v3Flags){
        lines.push(
            makeLine(cnt.v3Flags, 'binary', 'V3 flags')
        );
    }
    lines.push(
        makeLine(cnt.name, 'string', 'Relative file path')
    );
    return lines;
}

function reprExtensionEntry(ext: ExtensionEntry): (string | number)[] {
    return [
        makeLine(ext.signature, 'string', 'Extension signature'),
        makeLine(ext.size, 'number', 'Extension body length'),
        makeLine(ext.body, 'HEX', 'Extension body')
    ];
}

// Make a line of the output text,
// consisting of bytes as HEX, "interpreted" bytes, and explanation comment
function makeLine(
    numbers: number[] | Uint8Array,
    type: 'HEX'| 'hex'|'binary'|'string'|'number' = 'HEX',
    message?: string
){
    const parts = [bytesToHex(numbers)];
    if(type === 'hex'){
        parts.push(bytesToHex(numbers, '', false));
    } else if(type === 'binary'){
        parts.push(bytesToBits(numbers));
    } else if(type === 'string'){
        parts.push(bytesToString(numbers, true));
    } else if(type === 'number'){
        parts.push(bytesToNumber(numbers).toString());
    } else if(type === 'HEX'){
        // do nothing
    }
    if(message){
        parts.push(message);
    }
    return parts.join(' // ');
}

// // Helper functions to "interpret" bytes as numbers, strings, bits, or get hex-representations
function bytesToNumber(numbers: number[] | Uint8Array): number {
    let ret = 0;
    for(const x of numbers){
        ret*= 2**8;
        ret += x;
    }
    return ret;
}

function bytesToString(bytes: number[] | Uint8Array, quote = false): string {
    const numbers = [...bytes];
    while(numbers.length > 0 && numbers[numbers.length - 1] === 0){
        numbers.pop();
    }
    const s = String.fromCharCode(...numbers);
    if(quote){
        return `"${s}"`;
    }
    return s;
}

function bytesToBits(numbers: number[] | Uint8Array): string {
    const bits: string[] = [];
    for(const x of numbers){
        bits.push(x.toString(2).toLocaleUpperCase().padStart(8, '0'));
    }
    return bits.join(' ');
}

function bytesToHex(numbers: number[] | Uint8Array, sep = ' ', toUpper = true): string {
    const hexs: string[] = [];
    for(const x of numbers){
        let s = x.toString(16).padStart(2, '0');
        if(toUpper){
            s = s.toLocaleUpperCase();
        }
        hexs.push(s);
    }
    return hexs.join(sep);
}
