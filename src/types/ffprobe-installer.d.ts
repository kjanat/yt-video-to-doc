declare module "@ffprobe-installer/ffprobe" {
	interface FFprobeInstaller {
		path: string;
		version: string;
		url: string;
	}

	const ffprobeInstaller: FFprobeInstaller;
	export default ffprobeInstaller;
}
