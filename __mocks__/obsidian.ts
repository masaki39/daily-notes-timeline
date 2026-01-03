export class Notice {
	static messages: string[] = [];
	message: string;

	constructor(message: string) {
		this.message = message;
		Notice.messages.push(message);
	}
}

export class Plugin {
	app: any;

	constructor() {
		this.app = {
			vault: {
				adapter: { basePath: '' },
				getAbstractFileByPath: () => null,
				getFiles: () => [],
				read: async () => '',
				modify: async () => {}
			},
			fileManager: { renameFile: async () => {} },
			workspace: {
				getLeaf: () => ({
					setViewState: async () => {}
				})
			}
		};
	}

	addCommand() {
		/* noop */
	}
}

export class PluginSettingTab {}
export class Setting {}
export class App {}

export class ItemView {
	leaf: any;
	contentEl: any;
	constructor(leaf?: any) {
		this.leaf = leaf;
		this.contentEl = document?.createElement?.('div') ?? {};
	}
}

export class MarkdownView {
	file: any;
	constructor(file: any) {
		this.file = file;
	}
}

export class Editor {}

export class TFile {}

export const MarkdownRenderer = {
	renderMarkdown: async () => {}
};

export const normalizePath = (input: string): string => input.replace(/\\/g, '/').replace(/\/\/+/g, '/');
