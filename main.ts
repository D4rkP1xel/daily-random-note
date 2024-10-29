import { App, Plugin, PluginSettingTab, Setting, TextComponent } from 'obsidian';
import { createPopper, Instance } from '@popperjs/core';
import { addPathToPathList, getFolderPaths, selectRandomFileFromPaths } from 'utils/pathOperations';
import { compareDates, getDayString, getTomorrowDayString, isTimeReadyToShowNote, timeDif } from 'utils/timeUtils';

interface RandomInstance {
	includePaths: string,
	excludePaths: string,
	name: string,
	openOnStartup: boolean,
}

interface MyPluginSettings {
	randomInstances: RandomInstance[],

	// DD-MM-YYYY
	nextRandomNotesDay: string,
	timeToResetDailyRandomNotes: [number, number]
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	randomInstances: [],
	nextRandomNotesDay: getTomorrowDayString(),
	timeToResetDailyRandomNotes: [8, 0]
}

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;
	private popperInstance: null | Instance = null
	private dropdown: HTMLDivElement | null = null
	private isRandomNoteSuggestionsOpened = false
	private outsideClickListener: ((event: any) => void) | null = null
	public currentTimeDif: string = ""
	private settingsTab: SampleSettingTab | null = null;
	async onload() {
		await this.loadSettings();

		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon('dice', 'Daily Random Note', (evt: MouseEvent) => {
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
						this.openRandomNoteWithInstance(randomInstance)
						this.dropdown?.remove();
						this.popperInstance?.destroy();
						this.isRandomNoteSuggestionsOpened = false
					});
					this.dropdown?.appendChild(option);
				});

				this.outsideClickListener = (event: any) => {
					if (!this.dropdown?.contains(event.target) && event.target !== ribbonIconEl) {
						this.dropdown?.remove();
						this.popperInstance?.destroy();
						if (this.outsideClickListener)
							document.removeEventListener('mousedown', this.outsideClickListener);
						this.isRandomNoteSuggestionsOpened = false
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
		this.settingsTab = new SampleSettingTab(this.app, this)

		this.addSettingTab(this.settingsTab);

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		//this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
		//	console.log('click', evt);
		//});

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(window.setInterval(() => this.checkTimeAndOpenRandomNotes(), 1000 * 5));
		this.registerInterval(window.setInterval(() => {
			let timeSplit = this.settings.nextRandomNotesDay.split("/")
			let timeToCheck: Date = new Date()
			timeToCheck.setDate(parseInt(timeSplit[0]))
			timeToCheck.setMonth(parseInt(timeSplit[1]))
			timeToCheck.setFullYear(parseInt(timeSplit[2]))
			timeToCheck.setHours(this.settings.timeToResetDailyRandomNotes[0])
			timeToCheck.setMinutes(this.settings.timeToResetDailyRandomNotes[1])
			this.currentTimeDif = timeDif(new Date(), timeToCheck)
			console.log(this.currentTimeDif)
			// Update the settings tab display
			this.settingsTab?.updateTimeDisplay();
		}, 1000));

		// Wait for the vault and workspace to fully load
		this.app.workspace.onLayoutReady(async () => {
			// Now it's safe to call getAbstractFileByPath

			// TEST DELETE AFTER
			//const today = getDayString(new Date())
			//this.settings.nextRandomNotesTimestamp = today
			//await this.saveSettings();
			// TEST END
			await this.checkTimeAndOpenRandomNotes()
		});
	}

	async checkTimeAndOpenRandomNotes() {
		const today = getDayString(new Date())

		let cmp = compareDates(today, this.settings.nextRandomNotesDay)
		if (cmp == 1 || (cmp == 0 && isTimeReadyToShowNote([new Date().getHours(), new Date().getMinutes()], this.settings.timeToResetDailyRandomNotes))) {
			this.settings.nextRandomNotesDay = getTomorrowDayString()
			await this.saveSettings();
			this.settings.randomInstances.forEach((randomInstance) => {
				if (randomInstance.openOnStartup)
					this.openRandomNote(randomInstance)
			})
		}

	}

	openRandomNoteWithInstance(randomInstance: RandomInstance) {
		let isExclude = randomInstance.excludePaths != null && randomInstance.excludePaths != ""
		selectRandomFileFromPaths(this.app, isExclude ? randomInstance.excludePaths : randomInstance.includePaths, randomInstance.name, !isExclude)
	}

	openRandomNote(randomInstance: RandomInstance) {
		this.openRandomNoteWithInstance(randomInstance)
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
	private includedFoldersPopperInstance: null | Instance = null
	private excludedFoldersPopperInstance: null | Instance = null

	private suggestionFolderPaths: string[] = []

	private timeLeftSetting: HTMLElement | null = null;

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
			.addButton((button) =>
				button
					.setButtonText("Add New")
					.setCta() // Optional: makes the button more prominent
					.onClick(async () => {
						// Define what happens when the button is clicked
						this.plugin.settings.randomInstances.push({ name: "New Random Instance", includePaths: "", excludePaths: "", openOnStartup: true });
						await this.plugin.saveSettings();
						// Refresh the settings tab to show the new input
						this.display();
					})
			);

		const timeSetting = new Setting(containerEl)
			.setName("Daily Note Reset Time")
			.setDesc("Select the time at which the daily timer resets.");

		// Create a container for the hour and minute selects, styled to align horizontally
		const timeSelectContainer = timeSetting.controlEl.createDiv("time-select-container");
		timeSelectContainer.style.display = "flex";
		timeSelectContainer.style.gap = "8px";
		timeSelectContainer.style.marginLeft = "auto"; // Pushes it to the right side of the setting

		const hourSelect = document.createElement("select");
		for (let i = 0; i < 24; i++) {
			const option = document.createElement("option");
			option.value = i.toString();
			option.textContent = i.toString().padStart(2, '0');
			hourSelect.appendChild(option);
		}
		timeSelectContainer.appendChild(hourSelect);
		// Add the colon between the selects
		const colon = document.createElement("span");
		colon.textContent = ":";
		colon.style.alignSelf = "center"; // Centers the colon vertically
		timeSelectContainer.appendChild(colon);

		const minuteSelect = document.createElement("select");
		for (let i = 0; i < 60; i += 1) {
			const option = document.createElement("option");
			option.value = i.toString();
			option.textContent = i.toString().padStart(2, '0');
			minuteSelect.appendChild(option);
		}
		timeSelectContainer.appendChild(minuteSelect); hourSelect.value = this.plugin.settings.timeToResetDailyRandomNotes[0].toString()
		minuteSelect.value = this.plugin.settings.timeToResetDailyRandomNotes[1].toString()

		// Update settings when values change
		hourSelect.addEventListener("change", async () => {
			this.plugin.settings.timeToResetDailyRandomNotes[0] = parseInt(hourSelect.value);
			await this.plugin.saveSettings();
		});
		minuteSelect.addEventListener("change", async () => {
			this.plugin.settings.timeToResetDailyRandomNotes[1] = parseInt(minuteSelect.value);
			await this.plugin.saveSettings();
		});

		// Create a placeholder setting for "Time left"
		this.timeLeftSetting = new Setting(containerEl)
			.setName("Time left: ")
			.setDesc("Time until Daily Random Notes resets.")
			.setClass("setting-item-name")
			.settingEl;

		// Initial time display
		this.updateTimeDisplay();

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
				.setName("Open on Startup?")
				.addToggle(async (toggle) => {
					toggle.setValue(randomInstance.openOnStartup)
						.onChange(async (value) => {
							this.plugin.settings.randomInstances[randomInstanceIndex].openOnStartup = value;
							await this.plugin.saveSettings();
						})
				});

			new Setting(containerEl)
				.setName('Include Folders')
				.setDesc('Included paths to folders, separated by ","')
				.addText(text => {
					text.setPlaceholder('/example/one, /example/two')
						.setValue(randomInstance.includePaths)
						.onChange(async (value) => {
							this.plugin.settings.randomInstances[randomInstanceIndex].includePaths = value;
							await this.plugin.saveSettings();
							this.suggestionFolderPaths = getFolderPaths(this.plugin.settings.randomInstances[randomInstanceIndex].includePaths);
							this.resetDropdown()
							this.populateDropdown(text, randomInstanceIndex, true)
						});

					// Autocomplete functionality
					text.inputEl.addEventListener('focus', async () => {
						this.suggestionFolderPaths = getFolderPaths(this.plugin.settings.randomInstances[randomInstanceIndex].includePaths);
						this.showSuggestions(text, randomInstanceIndex, true);
					});

					// Remove dropdown when the input loses focus
					text.inputEl.addEventListener('blur', () => {
						this.includedFoldersPopperInstance?.destroy();

						Array.from(document.getElementsByClassName("folder-paths-suggestions")).forEach((element: HTMLElement) => {
							element.remove();
						});
					});

				});

			new Setting(containerEl)
				.setName('Exclude Folders')
				.setDesc('Excluded paths to folders, separated by "," (if this field is NOT empty, obsidian will search for every single file in your vault EXCEPT the folders specified here. "Include Folders" will be ignored as well.)')
				.addText(text => {
					text.setPlaceholder('/example/one, /example/two')
						.setValue(randomInstance.excludePaths)
						.onChange(async (value) => {
							this.plugin.settings.randomInstances[randomInstanceIndex].excludePaths = value;
							await this.plugin.saveSettings();
							this.suggestionFolderPaths = getFolderPaths(this.plugin.settings.randomInstances[randomInstanceIndex].excludePaths);
							this.resetDropdown()
							this.populateDropdown(text, randomInstanceIndex, false)
						});

					// Autocomplete functionality
					text.inputEl.addEventListener('focus', async () => {
						this.suggestionFolderPaths = getFolderPaths(this.plugin.settings.randomInstances[randomInstanceIndex].excludePaths);
						this.showSuggestions(text, randomInstanceIndex, false);
					});

					// Remove dropdown when the input loses focus
					text.inputEl.addEventListener('blur', () => {
						this.excludedFoldersPopperInstance?.destroy();

						Array.from(document.getElementsByClassName("folder-paths-suggestions")).forEach((element: HTMLElement) => {
							element.remove();
						});
					});
				});

			new Setting(containerEl)
				.setName("Delete \"" + randomInstance.name + "\"")
				.addButton((button) =>
					button
						.setButtonText("Delete")
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
		this.includedFoldersPopperInstance?.destroy();
		this.excludedFoldersPopperInstance?.destroy();
		//this.suggestEl.detach();
	}
	updateTimeDisplay() {
		if (this.timeLeftSetting) {
			const nameEl = this.timeLeftSetting.querySelector('.setting-item-name');
			console.log(nameEl)
			if (nameEl) {
				nameEl.textContent = `Time left: ${this.plugin.currentTimeDif}`;
			}
		}
	}

	// Show suggestions in an autocomplete dropdown
	private showSuggestions(textEl: TextComponent, randomInstanceIndex: number, isIncludedPath: boolean): void {
		// Create dropdown for suggestions
		const dropdown = document.createElement('div');
		dropdown.style.zIndex = '9998';
		dropdown.classList.add('suggestion-container', 'my-scrollable-suggestions', 'folder-paths-suggestions');
		document.body.appendChild(dropdown);

		// Create popper instance
		if (isIncludedPath) {
			this.includedFoldersPopperInstance = createPopper(textEl.inputEl, dropdown, {
				placement: 'bottom-start',
				modifiers: [{ name: 'offset', options: { offset: [0, 4] } }]
			});
		} else {
			this.excludedFoldersPopperInstance = createPopper(textEl.inputEl, dropdown, {
				placement: 'bottom-start',
				modifiers: [{ name: 'offset', options: { offset: [0, 4] } }]
			});
		}
		this.populateDropdown(textEl, randomInstanceIndex, isIncludedPath)
	}

	private resetDropdown() {
		const dropdown = document.getElementsByClassName("folder-paths-suggestions")[0]
		dropdown.innerHTML = ''
	}

	private populateDropdown(textEl: TextComponent, randomInstanceIndex: number, isIncludedPath: boolean) {
		const dropdown = document.getElementsByClassName("folder-paths-suggestions")[0]

		// Populate the dropdown with folder path options
		this.suggestionFolderPaths.forEach(path => {
			const option = document.createElement('div');

			// Add hover effect
			option.addEventListener('mouseover', () => option.classList.add('is-hovering-suggestion'));
			option.addEventListener('mouseout', () => option.classList.remove('is-hovering-suggestion'));

			option.style.zIndex = '9999'
			option.classList.add('suggestion-item');
			option.textContent = path;
			option.addEventListener('mousedown', async (event) => {
				event.preventDefault(); // prevent the blur from being called
				if (isIncludedPath) {
					let newPathlist = addPathToPathList(this.plugin.settings.randomInstances[randomInstanceIndex].includePaths, path);
					textEl.setValue(newPathlist);
					this.plugin.settings.randomInstances[randomInstanceIndex].includePaths = newPathlist
				} else {
					let newPathlist = addPathToPathList(this.plugin.settings.randomInstances[randomInstanceIndex].excludePaths, path);
					textEl.setValue(newPathlist);
					this.plugin.settings.randomInstances[randomInstanceIndex].excludePaths = newPathlist
				}
				await this.plugin.saveSettings();
				dropdown.remove();
				this.includedFoldersPopperInstance?.destroy();
				textEl.inputEl.blur()
			});
			dropdown.appendChild(option);
		});

	}
}
