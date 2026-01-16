export function getFileTypeCategory(extension: string): string {
  const ext = extension.toLowerCase();

  const imageExts = [
    'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'ico', 'tiff', 'tif', 'psd', 'ai', 'eps', 'raw', 'cr2', 'nef',
    'arw', 'dng', 'heic', 'heif', 'avif'
  ];
  if (imageExts.includes(ext)) return '图片';

  const documentExts = [
    'pdf', 'doc', 'docx', 'txt', 'rtf', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp', 'pages', 'numbers', 'key',
    'epub', 'mobi', 'azw', 'azw3'
  ];
  if (documentExts.includes(ext)) return '文档';

  const videoExts = [
    'mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'webm', 'm4v', '3gp', 'mpg', 'mpeg', 'mts', 'mxf', 'vob', 'ts', 'f4v',
    'rm', 'rmvb', 'asf'
  ];
  if (videoExts.includes(ext)) return '视频';

  const audioExts = [
    'mp3', 'wav', 'flac', 'aac', 'ogg', 'wma', 'm4a', 'opus', 'ape', 'alac', 'aiff', 'au', 'ra', 'amr', 'ac3', 'dts'
  ];
  if (audioExts.includes(ext)) return '音频';

  const archiveExts = [
    'zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'cab', 'iso', 'dmg', 'img', 'bin', 'cue', 'mdf', 'nrg', 'udf', 'lzh',
    'ace', 'arj'
  ];
  if (archiveExts.includes(ext)) return '压缩包';

  const codeExts = [
    'html', 'htm', 'css', 'scss', 'sass', 'less', 'js', 'jsx', 'ts', 'tsx', 'vue', 'svelte',
    'py', 'java', 'cpp', 'c', 'h', 'hpp', 'cs', 'php', 'rb', 'go', 'rs', 'swift', 'kt', 'scala', 'clj', 'hs', 'ml',
    'fs', 'vb', 'pas', 'pl', 'r', 'lua', 'dart', 'elm',
    'sh', 'bash', 'zsh', 'fish', 'ps1', 'bat', 'cmd', 'vbs',
    'json', 'xml', 'yaml', 'yml', 'toml', 'ini', 'cfg', 'conf', 'properties', 'env',
    'sql', 'mysql', 'pgsql', 'sqlite',
    'md', 'markdown', 'rst', 'tex', 'latex',
    'dockerfile', 'makefile', 'cmake', 'gradle', 'maven', 'sbt'
  ];
  if (codeExts.includes(ext)) return '代码';

  const dataExts = [
    'csv', 'tsv', 'json', 'xml', 'yaml', 'yml', 'sql', 'db', 'sqlite', 'sqlite3', 'mdb', 'accdb', 'dbf', 'parquet',
    'avro', 'orc'
  ];
  if (dataExts.includes(ext)) return '数据';

  const modelExts = [
    'obj', 'fbx', 'dae', 'blend', 'max', '3ds', 'stl', 'ply', 'x3d', 'gltf', 'glb', 'usd', 'usda', 'usdc', 'abc'
  ];
  if (modelExts.includes(ext)) return '3D模型';

  const fontExts = ['ttf', 'otf', 'woff', 'woff2', 'eot', 'pfb', 'pfm', 'afm', 'bdf', 'pcf'];
  if (fontExts.includes(ext)) return '字体';

  const shortcutExts = ['lnk', 'url'];
  if (shortcutExts.includes(ext)) return '快捷方式';

  const executableExts = [
    'exe', 'msi', 'dmg', 'pkg', 'deb', 'rpm', 'appimage', 'snap', 'flatpak', 'app', 'ipa', 'apk', 'xap'
  ];
  if (executableExts.includes(ext)) return '程序';

  const cadExts = ['dwg', 'dxf', 'step', 'stp', 'iges', 'igs', 'sat', 'brep', 'x_t', 'x_b'];
  if (cadExts.includes(ext)) return 'CAD';

  const ebookExts = ['epub', 'mobi', 'azw', 'azw3', 'fb2', 'lit', 'pdb', 'prc', 'lrf', 'tcr'];
  if (ebookExts.includes(ext)) return '电子书';

  return '其他';
}
