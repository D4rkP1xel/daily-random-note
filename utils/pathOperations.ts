import { randomInt } from "crypto";
import { App, Notice, TFile, TFolder } from "obsidian";

// Retrieve folder paths in the vault
export function getFolderPaths(randomInstancePaths: string, currentString: string): string[] {
	let randomInstancePathsArray = getPathsArrayFromPathList(randomInstancePaths, false)
	return this.app.vault.getAllLoadedFiles()
		.filter((file: any) => file instanceof TFolder)
		.map((folder: TFolder) => folder.path)
		.filter((folderPath: string) => {
			let lastPathSplit = currentString.split(",").map((s) => s.trim())
			let lastPath = lastPathSplit[lastPathSplit.length - 1]
			return (randomInstancePathsArray.indexOf(folderPath) == -1 || lastPath == folderPath) && folderPath.includes(lastPath)
		})
}

export function addPathToPathList(pathList: string, pathToAdd: string): string {
	let paths = getPathsArrayFromPathList(pathList, true)
	if (paths.length == 0)
		paths.push(pathToAdd)
	else paths[paths.length - 1] = pathToAdd

	return getPathListFromPathsArray(paths)
}

function getPathsArrayFromPathList(pathList: string, includeLastEmptySlot: boolean): string[] {
	if (pathList == "" || pathList == null) return []
	let paths = pathList.split(",").map((path: string) => path.trim())
	if (!includeLastEmptySlot && paths[paths.length - 1] == "")
		paths.pop()
	return paths
}

function getPathListFromPathsArray(paths: string[]): string {
	let pathList = ""
	paths.forEach((path) => {
		pathList += path
		pathList += ", "
	})
	return pathList
}

export async function selectRandomFileFromPaths(app: App, paths: string, tags: string, allTagsRequired: boolean, instanceName: string, isIncluded: boolean) {
	let pathsArray = getPathsArrayFromPathList(paths, true)
	let possibleFiles: string[] = []

	if (isIncluded) {
		pathsArray.forEach((folderPath) => {
			//get all files from folder and add to possibleFiles
			possibleFiles.push(...getRecursiveFilesFromFolder(app, folderPath, tags, allTagsRequired))
		})
	} else {
		let folders = getNonExcludedFolders(app, pathsArray)
		folders.forEach((folderPath) => {
			possibleFiles.push(...getRecursiveFilesFromFolder(app, folderPath, tags, allTagsRequired))
		})
	}

	try {
		if (possibleFiles.length == 0) throw ("No files found")
		let randomFilePath = possibleFiles[randomInt(0, possibleFiles.length)]
		await openFileInNewLeaf(app, randomFilePath)
	} catch (error) {
		if (error == "No files found") new Notice(instanceName + ': No files found.')
		else {
			console.error(error)
			new Notice(instanceName + ': Error opening file.');
		}
	}
}

function getNonExcludedFolders(app: App, folderPathsToExclude: string[]) {
	let folders = app.vault.getAllFolders(true).map((folder) => folder.path)
	let foldersToExclude: string[] = []
	folderPathsToExclude.forEach((folderPathToExclude) => {
		// includes the folderPathToExclude
		foldersToExclude.push(...getRecursiveFolders(app, folderPathToExclude))
	})
	foldersToExclude.forEach((foldersToExclude) => {
		let index = folders.indexOf(foldersToExclude)
		if (index != -1) {
			folders.splice(index, 1)
		}
	})
	return folders
}

function getRecursiveFolders(app: App, folderPath: string) {
	let folder = app.vault.getAbstractFileByPath(folderPath)
	if (!(folder instanceof TFolder)) return []

	let folders = [folderPath]
	folder.children.forEach((potentialFolder) => {
		if (potentialFolder instanceof TFolder) {
			folders.push(...getRecursiveFolders(app, potentialFolder.path))
		}
	})

	return folders
}

function getRecursiveFilesFromFolder(app: App, path: string, tags: string, allTagsRequired: boolean): string[] {
	let fileOrFolder = app.vault.getAbstractFileByPath(path);
	let filePaths: string[] = [];
	// Check if the path is a folder
	if (fileOrFolder instanceof TFolder) {
		// Loop through each item in the folder's children
		fileOrFolder.children.forEach((child) => {
			filePaths.push(...getRecursiveFilesFromFolder(app, child.path, tags, allTagsRequired))
		});
	} else if (fileOrFolder instanceof TFile) {
		const file = fileOrFolder;
		if (tags == "")
			filePaths.push(file.path)
		else {
			// tags are necessary here
			let tagsSplit = tags.split(",").map((t) => t.trim()).filter((t) => t != "")
			const metadata = app.metadataCache.getFileCache(file);
			// no tags found in file
			if (!metadata?.tags) return filePaths

			if (allTagsRequired) {
				let tagsLeft = tagsSplit.length
				metadata.tags.forEach(tag => {
					if (tagsSplit.includes(tag.tag)) tagsLeft--
				});
				if (tagsLeft == 0)
					filePaths.push(file.path)
			} else {
				metadata.tags.forEach(tag => {
					if (tagsSplit.includes(tag.tag)) {
						filePaths.push(file.path)
						return filePaths
					}
				});
			}
		}
	}

	return filePaths
}

async function openFileInNewLeaf(app: App, filePath: string) {
	const file = app.vault.getAbstractFileByPath(filePath);
	if (file && file instanceof TFile) {
		const leaf = app.workspace.getLeaf('tab');
		await leaf.openFile(file);
	} else {
		throw (`File not found at path: ${filePath}`);
	}
}
