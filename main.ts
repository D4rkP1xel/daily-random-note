import { App, Plugin, PluginSettingTab, Setting, TextComponent } from 'obsidian';
import { createPopper, Instance } from '@popperjs/core';
import { addPathToPathList, getFolderPaths, selectRandomFileFromPaths } from 'utils/pathOperations';
import { compareDates, formatTime, getDayFromString, getDayString, getTomorrowDayString, isTimeReadyToShowNote, timeDif } from 'utils/timeUtils';

const COMMAND_ID_PREFIX = "open-random-note-from-"

interface RandomInstance {
	isTabOpen: boolean,
	includePaths: string,
	excludePaths: string,
	useTags: boolean,
	allTagsRequired: boolean,
	tags: string,
	name: string,
	openOnStartup: boolean,
	commandID: string,
}

interface DailyRandomNoteSettings {
	randomInstances: RandomInstance[],

	// DD-MM-YYYY
	nextRandomNotesDay: string,
	timeToResetDailyRandomNotes: [number, number]
	previousCommandIDs: string[]
}

const DEFAULT_SETTINGS: DailyRandomNoteSettings = {
	randomInstances: [],
	nextRandomNotesDay: getTomorrowDayString(),
	timeToResetDailyRandomNotes: [8, 0],
	previousCommandIDs: [],
}

export default class DailyRandomNotePlugin extends Plugin {
	settings: DailyRandomNoteSettings;
	private popperInstance: null | Instance = null
	private dropdown: HTMLDivElement | null = null
	private isRandomNoteSuggestionsOpened = false
	private outsideClickListener: ((event: any) => void) | null = null
	public currentTimeDif: string = ""
	private settingsTab: DailyRandomNoteSettingTab | null = null;
	async onload() {
		await this.loadSettings();
		await this.fixRandomInstancesWithNoCmdID()
		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon('dices', 'Daily Random Note', (evt: MouseEvent) => {
			// Called when the user clicks the icon.
			if (!this.isRandomNoteSuggestionsOpened) {
				//new Notice('This is a notice!');
				this.isRandomNoteSuggestionsOpened = true
				this.dropdown = document.createElement('div');
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

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.settingsTab = new DailyRandomNoteSettingTab(this.app, this)

		this.addSettingTab(this.settingsTab);

		// Load each randomInstance as a command on startup 
		this.updateCommandPalette()

		// Safely start intervals only after workspace is ready
		this.app.workspace.onLayoutReady(() => {
			// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
			// check every 5 seconds if time is up to open the random notes
			this.registerInterval(window.setInterval(() => this.checkTimeAndOpenRandomNotes(), 1000 * 5));

			// update the settings timer every second
			this.registerInterval(window.setInterval(() => {
				let timeToCheck = this.getDailyRandomNoteResetTime()
				let timeDifVar = timeDif(new Date(), timeToCheck)
				this.currentTimeDif = formatTime(timeDifVar[0], timeDifVar[1], timeDifVar[2])
				// Update the settings tab display
				this.settingsTab?.updateTimeDisplay();
			}, 1000));
		})
	}

	updateCommandPalette() {
		// Load each randomInstance as a command on startup 
		this.settings.previousCommandIDs.forEach((cmd) => {
			this.removeCommand(cmd)
		})
		this.settings.previousCommandIDs = []

		this.settings.randomInstances.forEach(randomInstance => {
			this.settings.previousCommandIDs.push(randomInstance.commandID)
			this.addCommand({
				id: randomInstance.commandID,
				name: `Open one '${randomInstance.name}'`,
				callback: async () => { this.openRandomNoteWithInstance(randomInstance) }
			});
		});
	}

	// only runs on startup
	// fixes issues with already created RandomInstances (which didn't have commandIDs)
	async fixRandomInstancesWithNoCmdID() {
		let didFindInstanceWithNoCommandID = false
		this.settings.randomInstances.forEach(randomInstance => {
			if (!randomInstance.commandID) {
				didFindInstanceWithNoCommandID = true
				randomInstance.commandID = `${COMMAND_ID_PREFIX}${randomInstance.name}`
			}
		})
		if (didFindInstanceWithNoCommandID) await this.saveSettings()
	}

	getDailyRandomNoteResetTime() {
		let timeSplit = this.settings.nextRandomNotesDay.split("/")
		let timeToCheck: Date = new Date()
		timeToCheck.setDate(parseInt(timeSplit[0]))
		timeToCheck.setMonth(parseInt(timeSplit[1]))
		timeToCheck.setFullYear(parseInt(timeSplit[2]))
		timeToCheck.setHours(this.settings.timeToResetDailyRandomNotes[0])
		timeToCheck.setMinutes(this.settings.timeToResetDailyRandomNotes[1])
		timeToCheck.setSeconds(0)

		return timeToCheck
	}

	async checkTimeAndOpenRandomNotes() {
		const today = getDayString(new Date())

		let cmp = compareDates(today, this.settings.nextRandomNotesDay)
		if (cmp == 1 || (cmp == 0 && isTimeReadyToShowNote([new Date().getHours(), new Date().getMinutes()], this.settings.timeToResetDailyRandomNotes))) {
			console.log(this.settings.randomInstances)
			this.settings.randomInstances.forEach((randomInstance) => {
				if (randomInstance.openOnStartup)
					this.openRandomNote(randomInstance)
			})
			this.settings.nextRandomNotesDay = getTomorrowDayString()
			await this.saveSettings();
		}
	}

	openRandomNoteWithInstance(randomInstance: RandomInstance) {
		let isExclude = randomInstance.excludePaths != null && randomInstance.excludePaths != ""
		let paths = isExclude ? randomInstance.excludePaths : randomInstance.includePaths
		let tags = randomInstance.useTags ? randomInstance.tags : ""

		selectRandomFileFromPaths(this.app, paths, tags, randomInstance.allTagsRequired, randomInstance.name, !isExclude)
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
		this.updateCommandPalette()
		await this.saveData(this.settings);
	}
}

class DailyRandomNoteSettingTab extends PluginSettingTab {
	plugin: DailyRandomNotePlugin;
	private includedFoldersPopperInstance: null | Instance = null
	private excludedFoldersPopperInstance: null | Instance = null

	private suggestionFolderPaths: string[] = []

	private timeLeftSetting: HTMLElement | null = null;

	constructor(app: App, plugin: DailyRandomNotePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		const timeSetting = new Setting(containerEl)
			.setName("Daily note reset time")
			.setDesc("Select the time at which the daily timer resets.");

		// Create a container for the hour and minute selects, styled to align horizontally
		const timeSelectContainer = timeSetting.controlEl.createDiv();
		timeSelectContainer.addClass("time-select-container")

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
		colon.addClass("time-colon"); // Centers the colon vertically
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
			let timeDifVar = timeDif(new Date(), this.plugin.getDailyRandomNoteResetTime())
			if (timeDifVar[0] >= 24) {
				this.plugin.settings.nextRandomNotesDay = getDayString(new Date())
			}
			let nextRandomNotesDay = getDayFromString(this.plugin.settings.nextRandomNotesDay)
			let today = new Date()
			if (nextRandomNotesDay.getDate() == today.getDate() &&
				(this.plugin.settings.timeToResetDailyRandomNotes[0] < today.getHours()) ||
				(this.plugin.settings.timeToResetDailyRandomNotes[0] == today.getHours() && this.plugin.settings.timeToResetDailyRandomNotes[1] < today.getMinutes())) {
				this.plugin.settings.nextRandomNotesDay = getTomorrowDayString()
			}
			await this.plugin.saveSettings();
		});
		minuteSelect.addEventListener("change", async () => {
			this.plugin.settings.timeToResetDailyRandomNotes[1] = parseInt(minuteSelect.value);
			let timeDifVar = timeDif(new Date(), this.plugin.getDailyRandomNoteResetTime())
			if (timeDifVar[0] >= 24) {
				this.plugin.settings.nextRandomNotesDay = getDayString(new Date())
			}
			let nextRandomNotesDay = getDayFromString(this.plugin.settings.nextRandomNotesDay)
			let today = new Date()
			if (nextRandomNotesDay.getDate() == today.getDate() &&
				(this.plugin.settings.timeToResetDailyRandomNotes[0] < today.getHours()) ||
				(this.plugin.settings.timeToResetDailyRandomNotes[0] == today.getHours() && this.plugin.settings.timeToResetDailyRandomNotes[1] < today.getMinutes())) {
				this.plugin.settings.nextRandomNotesDay = getTomorrowDayString()
			}
			await this.plugin.saveSettings();
		});

		// Create a placeholder setting for "Time left"
		this.timeLeftSetting = new Setting(containerEl)
			.setName("Time left: ")
			.setDesc("Time until daily random notes resets.")
			.setClass("setting-item-name")
			.settingEl;

		// Initial time display
		this.updateTimeDisplay();
		new Setting(containerEl).setName('Manage random instances').setHeading();

		// Adding a setting with a button
		let addInstance = new Setting(containerEl)
			.setName("Add one random instance")
			.addButton((button) =>
				button
					.setButtonText("Add new")
					.setCta() // Optional: makes the button more prominent
					.onClick(async () => {
						// Define what happens when the button is clicked
						let randomInstanceName = "New Random Instance"
						this.plugin.settings.randomInstances.push({ name: randomInstanceName, includePaths: "", excludePaths: "", openOnStartup: true, useTags: false, tags: "", allTagsRequired: true, isTabOpen: true, commandID: `${COMMAND_ID_PREFIX}${randomInstanceName}` });
						await this.plugin.saveSettings();

						// Refresh the settings tab to show the new input
						this.display();
					})
			);
		addInstance.settingEl.addClass("add-instance-button")

		this.plugin.settings.randomInstances.forEach((randomInstance, randomInstanceIndex) => {
			const instanceParentDiv = containerEl.createDiv();
			instanceParentDiv.addClass("instance-container")

			const collapsibleHeader = instanceParentDiv.createDiv();
			collapsibleHeader.addClass("collapsible-container-header")

			new Setting(collapsibleHeader).setName(`${randomInstance.name}`).setHeading();

			// Create the toggle button and add it to the same div
			const toggleButton = collapsibleHeader.createEl("button", { text: randomInstance.isTabOpen ? "▼" : "►" });
			const settingsContent = instanceParentDiv.createDiv();
			if (randomInstance.isTabOpen) {
				settingsContent.classList.add("instance-tab-open");
				settingsContent.classList.remove("instance-tab-closed");
			} else {
				settingsContent.classList.add("instance-tab-closed");
				settingsContent.classList.remove("instance-tab-open");
			}

			// Toggle functionality for the button
			toggleButton.addEventListener("click", async () => {
				if (settingsContent.hasClass("instance-tab-open")) {
					settingsContent.classList.add("instance-tab-closed");
					settingsContent.classList.remove("instance-tab-open");
					this.plugin.settings.randomInstances[randomInstanceIndex].isTabOpen = false;
					await this.plugin.saveSettings()
					toggleButton.textContent = "►"; // Change to right arrow to indicate collapsed
				} else {
					settingsContent.classList.add("instance-tab-open");
					settingsContent.classList.remove("instance-tab-closed");
					this.plugin.settings.randomInstances[randomInstanceIndex].isTabOpen = true;
					await this.plugin.saveSettings()
					toggleButton.textContent = "▼"; // Change back to down arrow to indicate expanded
				}
			});

			new Setting(settingsContent)
				.setName('Name')
				.addText(text => {
					text.setPlaceholder('Insert name.')
						.setValue(randomInstance.name)
						.onChange(async (value) => {
							this.plugin.settings.randomInstances[randomInstanceIndex].name = value;
							this.plugin.settings.randomInstances[randomInstanceIndex].commandID = `${COMMAND_ID_PREFIX}${value}`;
							await this.plugin.saveSettings();
						});
					text.inputEl.addEventListener("blur", () => {
						this.display()
					})
				});

			new Setting(settingsContent)
				.setName("Open on startup/reset?")
				.setDesc("If toggled on, when the reset time hits 0, random files from this instance will automatically open.")
				.addToggle(async (toggle) => {
					toggle.setValue(randomInstance.openOnStartup)
						.onChange(async (value) => {
							this.plugin.settings.randomInstances[randomInstanceIndex].openOnStartup = value;
							await this.plugin.saveSettings();
						})
				});

			new Setting(settingsContent)
				.setName('Include folders')
				.setDesc('Included paths to folders, separated by ","')
				.addText(text => {
					text.setPlaceholder('/example/one, /example/two')
						.setValue(randomInstance.includePaths)
						.onChange(async (value) => {
							this.plugin.settings.randomInstances[randomInstanceIndex].includePaths = value;
							await this.plugin.saveSettings();
							this.suggestionFolderPaths = getFolderPaths(this.app, this.plugin.settings.randomInstances[randomInstanceIndex].includePaths, value);
							this.resetDropdown()
							this.populateDropdown(text, randomInstanceIndex, true)
						});

					// Autocomplete functionality
					text.inputEl.addEventListener('focus', async () => {
						this.suggestionFolderPaths = getFolderPaths(this.app, this.plugin.settings.randomInstances[randomInstanceIndex].includePaths, text.getValue());
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

			new Setting(settingsContent)
				.setName('Exclude folders')
				.setDesc('Excluded paths to folders, separated by "," (if this field is NOT empty, obsidian will search for every single file in your vault EXCEPT the folders specified here. "Include Folders" will be ignored as well.)')
				.addText(text => {
					text.setPlaceholder('/example/one, /example/two')
						.setValue(randomInstance.excludePaths)
						.onChange(async (value) => {
							this.plugin.settings.randomInstances[randomInstanceIndex].excludePaths = value;
							await this.plugin.saveSettings();
							this.suggestionFolderPaths = getFolderPaths(this.app, this.plugin.settings.randomInstances[randomInstanceIndex].excludePaths, value);
							this.resetDropdown()
							this.populateDropdown(text, randomInstanceIndex, false)
						});

					// Autocomplete functionality
					text.inputEl.addEventListener('focus', async () => {
						this.suggestionFolderPaths = getFolderPaths(this.app, this.plugin.settings.randomInstances[randomInstanceIndex].excludePaths, text.getValue());
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

			new Setting(settingsContent)
				.setName("Use tags for filtering?")
				.addToggle(async (toggle) => {
					toggle.setValue(randomInstance.useTags)
						.onChange(async (value) => {
							this.plugin.settings.randomInstances[randomInstanceIndex].useTags = value;
							await this.plugin.saveSettings();
							if (value) {
								tagsContent.classList.add("instance-tags-open");
								tagsContent.classList.remove("instance-tags-closed");
							} else {
								tagsContent.classList.add("instance-tags-closed");
								tagsContent.classList.remove("instance-tags-open");
							}
						})
				});

			const tagsContent = settingsContent.createDiv();
			if (randomInstance.useTags) {
				tagsContent.classList.add("instance-tags-open");
				tagsContent.classList.remove("instance-tags-closed");
			} else {
				tagsContent.classList.add("instance-tags-closed");
				tagsContent.classList.remove("instance-tags-open");
			}

			new Setting(tagsContent)
				.setName("All tags required?")
				.setDesc("If toggled on, obsidian will only search for files containing ALL tags simultaneously. Otherwise any file containing at least one of the tags will be considered valid.")
				.addToggle(async (toggle) => {
					toggle.setValue(randomInstance.allTagsRequired)
						.onChange(async (value) => {
							this.plugin.settings.randomInstances[randomInstanceIndex].allTagsRequired = value;
							await this.plugin.saveSettings();
						})
				});


			new Setting(tagsContent)
				.setName('Tags')
				.setDesc('Insert tags, separated by ","')
				.addText(text => {
					text.setPlaceholder('#exampletag1, #exampletag2')
						.setValue(this.plugin.settings.randomInstances[randomInstanceIndex].tags)
						.onChange(async (value) => {
							this.plugin.settings.randomInstances[randomInstanceIndex].tags = value;
							await this.plugin.saveSettings();
						});

					// Autocomplete functionality
					text.inputEl.addEventListener('focus', async () => {
						this.suggestionFolderPaths = getFolderPaths(this.app, this.plugin.settings.randomInstances[randomInstanceIndex].tags, text.getValue());
					});

					// Remove dropdown when the input loses focus
					text.inputEl.addEventListener('blur', () => {
						this.excludedFoldersPopperInstance?.destroy();

						Array.from(document.getElementsByClassName("folder-paths-suggestions")).forEach((element: HTMLElement) => {
							element.remove();
						});
					});
				});

			new Setting(settingsContent)
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

			//containerEl.createEl('hr'); // This adds a horizontal rule
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
			if (nameEl) {
				nameEl.textContent = `Time left: ${this.plugin.currentTimeDif}`;
			}
		}
	}

	// Show suggestions in an autocomplete dropdown
	private showSuggestions(textEl: TextComponent, randomInstanceIndex: number, isIncludedPath: boolean): void {
		// Create dropdown for suggestions
		const dropdown = document.createElement('div');
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
		dropdown.empty()
	}

	private populateDropdown(textEl: TextComponent, randomInstanceIndex: number, isIncludedPath: boolean) {
		const dropdown = document.getElementsByClassName("folder-paths-suggestions")[0]

		// Populate the dropdown with folder path options
		this.suggestionFolderPaths.forEach(path => {
			const option = document.createElement('div');

			// Add hover effect
			option.addEventListener('mouseover', () => option.classList.add('is-hovering-suggestion'));
			option.addEventListener('mouseout', () => option.classList.remove('is-hovering-suggestion'));

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
