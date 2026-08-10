export namespace app {
	
	export class GlobalProxyView {
	    enabled: boolean;
	    type: string;
	    host: string;
	    port: number;
	    user: string;
	    password: string;
	
	    static createFrom(source: any = {}) {
	        return new GlobalProxyView(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.enabled = source["enabled"];
	        this.type = source["type"];
	        this.host = source["host"];
	        this.port = source["port"];
	        this.user = source["user"];
	        this.password = source["password"];
	    }
	}

}

export namespace define {
	
	export class DirEntry {
	    name: string;
	    path: string;
	    isDir: boolean;
	    kind: string;
	
	    static createFrom(source: any = {}) {
	        return new DirEntry(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.path = source["path"];
	        this.isDir = source["isDir"];
	        this.kind = source["kind"];
	    }
	}
	export class FileInfo {
	    path: string;
	    name: string;
	    size: number;
	    isDir: boolean;
	    kind: string;
	    editable: boolean;
	    largeMode: boolean;
	    modTime: string;
	
	    static createFrom(source: any = {}) {
	        return new FileInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.path = source["path"];
	        this.name = source["name"];
	        this.size = source["size"];
	        this.isDir = source["isDir"];
	        this.kind = source["kind"];
	        this.editable = source["editable"];
	        this.largeMode = source["largeMode"];
	        this.modTime = source["modTime"];
	    }
	}
	export class LaunchInfo {
	    windowId: string;
	    openPath: string;
	    openIsDir: boolean;
	    shouldRestore: boolean;
	
	    static createFrom(source: any = {}) {
	        return new LaunchInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.windowId = source["windowId"];
	        this.openPath = source["openPath"];
	        this.openIsDir = source["openIsDir"];
	        this.shouldRestore = source["shouldRestore"];
	    }
	}
	export class MdHeading {
	    level: number;
	    title: string;
	    line: number;
	
	    static createFrom(source: any = {}) {
	        return new MdHeading(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.level = source["level"];
	        this.title = source["title"];
	        this.line = source["line"];
	    }
	}
	export class OpenPlacementPrefs {
	    target: string;
	    mode: string;
	    parentFolderTarget: string;
	    parentFolderMode: string;
	
	    static createFrom(source: any = {}) {
	        return new OpenPlacementPrefs(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.target = source["target"];
	        this.mode = source["mode"];
	        this.parentFolderTarget = source["parentFolderTarget"];
	        this.parentFolderMode = source["parentFolderMode"];
	    }
	}
	export class PickOpenResult {
	    path: string;
	    isDir: boolean;
	
	    static createFrom(source: any = {}) {
	        return new PickOpenResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.path = source["path"];
	        this.isDir = source["isDir"];
	    }
	}
	export class QueryResult {
	    success: boolean;
	    message: string;
	    data?: any;
	
	    static createFrom(source: any = {}) {
	        return new QueryResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.message = source["message"];
	        this.data = source["data"];
	    }
	}
	export class TextSlice {
	    startLine: number;
	    endLine: number;
	    totalLines: number;
	    content: string;
	    eof: boolean;
	
	    static createFrom(source: any = {}) {
	        return new TextSlice(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.startLine = source["startLine"];
	        this.endLine = source["endLine"];
	        this.totalLines = source["totalLines"];
	        this.content = source["content"];
	        this.eof = source["eof"];
	    }
	}
	export class WindowSessionTab {
	    path: string;
	    name: string;
	    kind: string;
	    editable: boolean;
	    largeMode: boolean;
	    size: number;
	    dirty: boolean;
	    untitled: boolean;
	    languageHint?: string;
	    content?: string;
	
	    static createFrom(source: any = {}) {
	        return new WindowSessionTab(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.path = source["path"];
	        this.name = source["name"];
	        this.kind = source["kind"];
	        this.editable = source["editable"];
	        this.largeMode = source["largeMode"];
	        this.size = source["size"];
	        this.dirty = source["dirty"];
	        this.untitled = source["untitled"];
	        this.languageHint = source["languageHint"];
	        this.content = source["content"];
	    }
	}
	export class WindowSessionState {
	    version: number;
	    windowId: string;
	    roots: string[];
	    activePath: string;
	    untitledSeq: number;
	    tabs: WindowSessionTab[];
	
	    static createFrom(source: any = {}) {
	        return new WindowSessionState(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.version = source["version"];
	        this.windowId = source["windowId"];
	        this.roots = source["roots"];
	        this.activePath = source["activePath"];
	        this.untitledSeq = source["untitledSeq"];
	        this.tabs = this.convertValues(source["tabs"], WindowSessionTab);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

