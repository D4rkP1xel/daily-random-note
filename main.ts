import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, TextComponent, TFolder } from 'obsidian';
import { createPopper, Instance } from '@popperjs/core';
import { addPathToPathList, getFolderPaths } from 'utils/pathOperations';
// Remember to rename these classes and interfaces!

interface RandomInstance {
	path: string,
	name: string,
}

interface MyPluginSettings {
	foldersToGetFilesFrom: string[],
	randomInstances: RandomInstance[],
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	foldersToGetFilesFrom: [],
	randomInstances: [],
}

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;
	private popperInstance: null | Instance = null
	private dropdown: HTMLDivElement | null = null
	private isRandomNoteSuggestionsOpened = false
	private outsideClickListener: ((event: any) => void) | null = null

	async onload() {
		await this.loadSettings();

		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon('dice', 'Random Note Picker', (evt: MouseEvent) => {
			// Called when the user clicks the icon.
			if (!this.isRandomNoteSuggestionsOpened) {
				//new Notice('This is a notice!');
				this.isRandomNoteSuggestionsOpened = true
				this.dropdown = document.createElement('div');
				this.dropdown.style.zIndex = '9998';
				this.dropdown.classList.add('suggestion-container', 'my-scrollable-suggestions', 'folder-paths-suggestions');
				document.body.appendChild(this.dropdown);

				// Create popper instance
				this.popperInstance = createPopper(ribbonIconEl, this.dropdown, {
					placement: 'bottom-start',
					modifiers: [{ name: 'offset', options: { offset: [0, 4] } }]
				});
				this.settings.randomInstances.forEach(randomInstance => {
					const option = document.createElement('div');

					// Add hover effect
					option.addEventListener('mouseover', () => option.classList.add('is-hovering-suggestion'));
					option.addEventListener('mouseout', () => option.classList.remove('is-hovering-suggestion'));

					option.style.zIndex = '9999'
					option.classList.add('suggestion-item');
					option.textContent = randomInstance.name;
					option.addEventListener('mousedown', () => {
						this.dropdown?.remove();
						this.popperInstance?.destroy();
					});
					this.dropdown?.appendChild(option);
				});

				this.outsideClickListener = (event: any) => {
					if (!this.dropdown?.contains(event.target) && event.target !== ribbonIconEl) {
						this.dropdown?.remove();
						this.popperInstance?.destroy();
						if (this.outsideClickListener)
							document.removeEventListener('mousedown', this.outsideClickListener);
					}
				};

				document.addEventListener('mousedown', this.outsideClickListener);

			} else {
				this.dropdown?.remove();
				this.popperInstance?.destroy();
				if (this.outsideClickListener)
					document.removeEventListener('mousedown', this.outsideClickListener);
				this.isRandomNoteSuggestionsOpened = false
			}
		});
		// Perform additional things with the ribbon
		ribbonIconEl.addClass('my-plugin-ribbon-class');

		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText('Status Bar Text');

		// This adds a simple command that can be triggered anywhere
		//this.addCommand({
		//	id: 'open-sample-modal-simple',
		//	name: 'Open sample modal (simple)',
		//	callback: () => {
		//		new SampleModal(this.app).open();
		//	}
		//});
		//// This adds an editor command that can perform some operation on the current editor instance
		//this.addCommand({
		//	id: 'sample-editor-command',
		//	name: 'Sample editor command',
		//	editorCallback: (editor: Editor, view: MarkdownView) => {
		//		console.log(editor.getSelection());
		//		editor.replaceSelection('Sample Editor Command');
		//	}
		//});
		//// This adds a complex command that can check whether the current state of the app allows execution of the command
		//this.addCommand({
		//	id: 'open-sample-modal-complex',
		//	name: 'Open sample modal (complex)',
		//	checkCallback: (checking: boolean) => {
		//		// Conditions to check
		//		const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
		//		if (markdownView) {
		//			// If checking is true, we're simply "checking" if the command can be run.
		//			// If checking is false, then we want to actually perform the operation.
		//			if (!checking) {
		//				new SampleModal(this.app).open();
		//			}
		//
		//			// This command will only show up in Command Palette when the check function returns true
		//			return true;
		//		}
		//	}
		//});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SampleSettingTab(this.app, this));

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		//this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
		//	console.log('click', evt);
		//});

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		//this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

//class SampleModal extends Modal {
//	constructor(app: App) {
//		super(app);
//	}
//
//	onOpen() {
//		const { contentEl } = this;
//		contentEl.setText('Woah!');
//	}
//
//	onClose() {
//		const { contentEl } = this;
//		contentEl.empty();
//	}
//}

class SampleSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	//private sampleFolders = ["Folder1", "Folder2/Subfolder", "Another/Folder/Path",
	//	"Another/Folder/Path/Another/Folder/Path/Another/Folder/Path, Folder1", "Folder2/Subfolder", "Another/Folder/Path",
	//	"Another/Folder/Path/Another/Folder/Path/Another/Folder/Path, Folder1", "Folder2/Subfolder", "Another/Folder/Path",
	//	"Another/Folder/Path/Another/Folder/Path/Another/Folder/Path/Another/Folder/Path/Another/Folder/Path/Another/Folder/Path"]; // Local array of folder paths
	private popperInstance: null | Instance = null
	private folderPaths: string[] = []
	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		// Adding a setting with a button
		new Setting(containerEl)
			.setName("Add One Random Instance")
			.setDesc("Click to add one folder path to the list of folder paths.")
			.addButton((button) =>
				button
					.setButtonText("Add New")
					.setCta() // Optional: makes the button more prominent
					.onClick(async () => {
						// Define what happens when the button is clicked
						this.plugin.settings.randomInstances.push({ name: "New Random Instance", path: "" }); // Example action
						await this.plugin.saveSettings();
						// Refresh the settings tab to show the new input
						this.display();
					})
			);

		this.plugin.settings.randomInstances.forEach((randomInstance, randomInstanceIndex) => {
			containerEl.createEl('h3', { text: `${randomInstance.name}` });

			new Setting(containerEl)
				.setName('Random Instance Name')
				.addText(text => {
					text.setPlaceholder('Insert name.')
						.setValue(randomInstance.name)
						.onChange(async (value) => {
							this.plugin.settings.randomInstances[randomInstanceIndex].name = value;
							await this.plugin.saveSettings();
						});
					text.inputEl.addEventListener("blur", () => {
						this.display()
					})
				});

			new Setting(containerEl)
				.setName('Folder to get random files from')
				.setDesc('Path to folder')
				.addText(text => {
					text.setPlaceholder('Select folder path')
						.setValue(randomInstance.path)
						.onChange(async (value) => {
							this.plugin.settings.randomInstances[randomInstanceIndex].path = value;
							await this.plugin.saveSettings();
							this.folderPaths = getFolderPaths(this.plugin.settings.randomInstances[randomInstanceIndex].path);
							this.resetDropdown()
							this.populateDropdown(text, randomInstanceIndex)
						});

					// Autocomplete functionality
					text.inputEl.addEventListener('focus', async () => {
						this.folderPaths = getFolderPaths(this.plugin.settings.randomInstances[randomInstanceIndex].path);
						this.showSuggestions(text, randomInstanceIndex);
					});

					// Remove dropdown when the input loses focus
					text.inputEl.addEventListener('blur', () => {
						this.popperInstance?.destroy();

						Array.from(document.getElementsByClassName("folder-paths-suggestions")).forEach((element: HTMLElement) => {
							element.remove();
						});
					});

				});
			new Setting(containerEl)
				.setName("Remove Random Instance")
				.setDesc("Click to remove the random instance above.")
				.addButton((button) =>
					button
						.setButtonText("Remove")
						.setWarning() // Optional: makes the button more prominent
						.onClick(async () => {
							// Define what happens when the button is clicked
							this.plugin.settings.randomInstances.splice(randomInstanceIndex, 1); // Example action
							await this.plugin.saveSettings();
							// Refresh the settings tab to show the new input
							this.display();
						})
				);

			containerEl.createEl('hr'); // This adds a horizontal rule
		})



	}

	close(): void {
		this.popperInstance?.destroy();
		//this.suggestEl.detach();
	}


	// Show suggestions in an autocomplete dropdown
	private showSuggestions(textEl: TextComponent, randomInstanceIndex: number): void {
		// Create dropdown for suggestions
		const dropdown = document.createElement('div');
		dropdown.style.zIndex = '9998';
		dropdown.classList.add('suggestion-container', 'my-scrollable-suggestions', 'folder-paths-suggestions');
		document.body.appendChild(dropdown);

		// Create popper instance
		this.popperInstance = createPopper(textEl.inputEl, dropdown, {
			placement: 'bottom-start',
			modifiers: [{ name: 'offset', options: { offset: [0, 4] } }]
		});
		this.populateDropdown(textEl, randomInstanceIndex)
	}

	private resetDropdown() {
		const dropdown = document.getElementsByClassName("folder-paths-suggestions")[0]
		dropdown.innerHTML = ''
	}

	private populateDropdown(textEl: TextComponent, randomInstanceIndex: number) {
		const dropdown = document.getElementsByClassName("folder-paths-suggestions")[0]

		// Populate the dropdown with folder path options
		this.folderPaths.forEach(path => {
			const option = document.createElement('div');

			// Add hover effect
			option.addEventListener('mouseover', () => option.classList.add('is-hovering-suggestion'));
			option.addEventListener('mouseout', () => option.classList.remove('is-hovering-suggestion'));

			option.style.zIndex = '9999'
			option.classList.add('suggestion-item');
			option.textContent = path;
			option.addEventListener('mousedown', async (event) => {
				event.preventDefault(); // prevent the blur from being called
				let newPathlist = addPathToPathList(this.plugin.settings.randomInstances[randomInstanceIndex].path, path);
				textEl.setValue(newPathlist);
				this.plugin.settings.randomInstances[randomInstanceIndex].path = newPathlist
				await this.plugin.saveSettings();
				dropdown.remove();
				this.popperInstance?.destroy();
				textEl.inputEl.blur()
			});
			dropdown.appendChild(option);
		});

	}
}
