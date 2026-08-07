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

}

