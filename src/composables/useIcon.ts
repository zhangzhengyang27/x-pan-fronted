/**
 * useIcon —— 根据文件扩展名/类型返回 lucide 图标名
 * 支持：文件夹、图片、视频、音频、文档(doc/docx)、表格(excel)、PPT、PDF、压缩包、代码、文本、其他
 */
import type { Component } from 'vue'
import {
  Folder,
  FileText,
  FileImage,
  FileVideo,
  FileAudio,
  FileSpreadsheet,
  FileType,
  FileArchive,
  FileCode,
  File as FileIcon
} from '@lucide/vue'

export type FileKind =
  | 'folder'
  | 'image'
  | 'video'
  | 'audio'
  | 'doc'
  | 'excel'
  | 'ppt'
  | 'pdf'
  | 'archive'
  | 'code'
  | 'text'
  | 'other'

function extOf(name = ''): string {
  const i = name.lastIndexOf('.')
  return i >= 0 ? name.slice(i + 1).toLowerCase() : ''
}

const MAP: Record<string, FileKind> = {
  jpg: 'image',
  jpeg: 'image',
  png: 'image',
  gif: 'image',
  webp: 'image',
  bmp: 'image',
  svg: 'image',
  ico: 'image',
  mp4: 'video',
  webm: 'video',
  mov: 'video',
  mkv: 'video',
  avi: 'video',
  wmv: 'video',
  flv: 'video',
  m3u8: 'video',
  mp3: 'audio',
  wav: 'audio',
  ogg: 'audio',
  aac: 'audio',
  flac: 'audio',
  m4a: 'audio',
  doc: 'doc',
  docx: 'doc',
  xls: 'excel',
  xlsx: 'excel',
  csv: 'excel',
  ppt: 'ppt',
  pptx: 'ppt',
  pdf: 'pdf',
  zip: 'archive',
  rar: 'archive',
  '7z': 'archive',
  tar: 'archive',
  gz: 'archive',
  js: 'code',
  ts: 'code',
  tsx: 'code',
  jsx: 'code',
  vue: 'code',
  html: 'code',
  css: 'code',
  scss: 'code',
  less: 'code',
  json: 'code',
  java: 'code',
  py: 'code',
  go: 'code',
  c: 'code',
  cpp: 'code',
  h: 'code',
  sh: 'code',
  md: 'text',
  txt: 'text',
  log: 'text'
}

export function getFileKind(file: { fileType?: number; type?: string; name?: string }): FileKind {
  if (file.fileType === 0 || file.type === 'folder') return 'folder'
  const k = MAP[extOf(file.name)]
  return k || 'other'
}

const ICONS: Record<FileKind, Component> = {
  folder: Folder,
  image: FileImage,
  video: FileVideo,
  audio: FileAudio,
  doc: FileType,
  excel: FileSpreadsheet,
  ppt: FileType,
  pdf: FileText,
  archive: FileArchive,
  code: FileCode,
  text: FileText,
  other: FileIcon
}

export function useIcon() {
  function getFileIcon(file: { fileType?: number; type?: string; name?: string }): Component {
    const kind = getFileKind(file)
    return ICONS[kind]
  }

  return { getFileIcon, getFileKind }
}
