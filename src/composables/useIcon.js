/**
 * useIcon —— Element Plus 图标名 → Lucide 组件映射
 * 用法：
 *   import { resolveIcon } from '@/composables/useIcon'
 *   const Cmp = resolveIcon('Folder')
 *   <component :is="Cmp" class="size-4" />
 *
 * 支持以下写法：
 *   resolveIcon('Folder')                // PascalCase
 *   resolveIcon('FolderOpened')          // EP 命名 → Lucide 命名
 *   resolveIcon('el-icon-folder')        // 类名前缀
 */
import * as Lucide from '@lucide/vue'

const MAP = {
  // 文件 / 文件夹
  Folder: 'Folder',
  FolderOpened: 'FolderOpen',
  Document: 'File',
  DocumentCopy: 'Files',
  Picture: 'Image',
  PictureFilled: 'Image',
  VideoPlay: 'Play',
  VideoCamera: 'Video',
  Headset: 'Headphones',
  Film: 'Film',
  Music: 'Music',
  // 操作
  Search: 'Search',
  Refresh: 'RefreshCw',
  Plus: 'Plus',
  Edit: 'Pencil',
  EditPen: 'Pencil',
  Delete: 'Trash2',
  Share: 'Share2',
  Download: 'Download',
  Upload: 'Upload',
  UploadFilled: 'Upload',
  CopyDocument: 'Copy',
  Close: 'X',
  CloseBold: 'X',
  Check: 'Check',
  Warning: 'AlertTriangle',
  WarningFilled: 'AlertTriangle',
  InfoFilled: 'Info',
  CircleClose: 'XCircle',
  CircleCheck: 'CheckCircle',
  // 导航
  ArrowDown: 'ChevronDown',
  ArrowUp: 'ChevronUp',
  ArrowRight: 'ArrowRight',
  ArrowLeft: 'ArrowLeft',
  CaretBottom: 'ChevronDown',
  CaretTop: 'ChevronUp',
  CaretRight: 'ChevronRight',
  CaretLeft: 'ChevronLeft',
  ArrowRightBold: 'ArrowRight',
  DArrowRight: 'ChevronsRight',
  DArrowLeft: 'ChevronsLeft',
  // 视图
  View: 'Eye',
  Hide: 'EyeOff',
  Sunny: 'Sun',
  Moon: 'Moon',
  Bell: 'Bell',
  BellFilled: 'Bell',
  Setting: 'Settings',
  Tools: 'Wrench',
  User: 'User',
  UserFilled: 'UserCircle2',
  HomeFilled: 'Home',
  Menu: 'Menu',
  MoreFilled: 'MoreHorizontal',
  More: 'MoreHorizontal',
  Filter: 'Filter',
  Sort: 'ArrowUpDown',
  Grid: 'LayoutGrid',
  List: 'List',
  // 状态
  Lock: 'Lock',
  Unlock: 'Unlock',
  Loading: 'LoaderCircle',
  Connection: 'Cable',
  Link: 'Link2',
  Calendar: 'Calendar',
  Clock: 'Clock',
  Star: 'Star',
  StarFilled: 'Star',
  // 其他
  Promotion: 'Send',
  TrendCharts: 'TrendingUp',
  DataAnalysis: 'BarChart3',
  Postcard: 'CreditCard',
  Position: 'MapPin',
  Notebook: 'Notebook',
  Operation: 'Settings2',
  QuestionFilled: 'HelpCircle',
}

function toPascal(name) {
  return name
    .replace(/^(el-icon-)/, '')
    .replace(/-(\w)/g, (_, c) => c.toUpperCase())
    .replace(/^./, (c) => c.toUpperCase())
}

export function resolveIcon(name) {
  if (!name) return null
  const key = toPascal(name)
  const lucideKey = MAP[key] || key
  return Lucide[lucideKey] || Lucide.CircleHelp || null
}

/** 简化模板使用：<LucideIcon name="Folder" /> */
export default {
  name: 'LucideIcon',
  props: {
    name: {type: String, required: true},
    size: {type: [Number, String], default: 16},
  },
  computed: {
    iconComponent() {
      return resolveIcon(this.name)
    },
  },
  render(h) {
    if (!this.iconComponent) return null
    return h(this.iconComponent, {
      attrs: {'stroke-width': 1.75, size: this.size},
    })
  },
}