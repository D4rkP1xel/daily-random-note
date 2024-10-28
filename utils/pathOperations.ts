import { TFolder } from "obsidian";

// Retrieve folder paths in the vault
export function getFolderPaths(randomInstancePaths: string): string[] {
	let randomInstancePathsArray = getPathsArrayFromPathList(randomInstancePaths)
	return this.app.vault.getAllLoadedFiles()
		.filter((file: any) => file instanceof TFolder)
		.map((folder: TFolder) => folder.path)
		.filter((folderPath: string) => randomInstancePathsArray.indexOf(folderPath) == -1);
}

export function addPathToPathList(pathList: string, pathToAdd: string): string {
	console.log(pathList, pathToAdd)
	let paths = getPathsArrayFromPathList(pathList)
	paths.push(pathToAdd)
	return getPathListFromPathsArray(paths)
}

export function getPathsArrayFromPathList(pathList: string): string[] {
	let paths = pathList.split(",").map((path: string) => path.trim())
	if (paths[paths.length - 1] == "")
		paths.pop()
	return paths
}

export function getPathListFromPathsArray(paths: string[]): string {
	let pathList = ""
	paths.forEach((path, index) => {
		if (index != 0)
			pathList += ", "
		pathList += path
	})
	return pathList
}
