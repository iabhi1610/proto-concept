/**
 * Every icon in the project is a GitHub Octicon (@primer/octicons-react).
 * Names mirror the lucide names the UI was written with, so components import from here
 * and the mapping lives in one place. Size comes from CSS (`size-4` etc.); 16px otherwise.
 */
import * as React from "react"
import * as O from "@primer/octicons-react"
import { cn } from "@/lib/utils"

type OcticonComponent = React.ComponentType<O.IconProps>
type IconProps = Omit<React.SVGProps<SVGSVGElement>, "ref"> & {
  className?: string
  /** accepted for lucide compatibility; Octicons are filled glyphs */
  strokeWidth?: number | string
  size?: number
}

function octicon(Icon: OcticonComponent, extra?: string) {
  function Octicon({ className, strokeWidth: _sw, size, ...rest }: IconProps) {
    return <Icon size={size ?? 16} className={cn("pc-octicon shrink-0", extra, className)} verticalAlign="middle" {...(rest as Record<string, unknown>)} />
  }
  Octicon.displayName = `Octicon(${Icon.displayName ?? Icon.name})`
  return Octicon
}

/* alerts & status */
export const AlertCircle = octicon(O.StopIcon)
export const AlertTriangle = octicon(O.AlertIcon)
export const TriangleAlert = AlertTriangle
export const TriangleAlertIcon = AlertTriangle
export const OctagonXIcon = octicon(O.StopIcon)
export const Info = octicon(O.InfoIcon)
export const InfoIcon = Info
export const CircleCheckIcon = octicon(O.CheckCircleIcon)
export const CircleHelp = octicon(O.QuestionIcon)
export const CircleDot = octicon(O.DotFillIcon)
export const Check = octicon(O.CheckIcon)
export const CheckIcon = Check
export const X = octicon(O.XIcon)
export const XIcon = X
export const Loader2 = octicon(O.SyncIcon)
export const Loader2Icon = Loader2

/* arrows & chevrons */
export const ArrowDown = octicon(O.ArrowDownIcon)
export const ArrowUp = octicon(O.ArrowUpIcon)
export const ArrowLeft = octicon(O.ArrowLeftIcon)
export const ArrowRight = octicon(O.ArrowRightIcon)
export const ArrowUpRight = octicon(O.ArrowUpRightIcon)
export const ArrowDownRight = octicon(O.ArrowDownRightIcon)
export const ChevronDown = octicon(O.ChevronDownIcon)
export const ChevronDownIcon = ChevronDown
export const ChevronUpIcon = octicon(O.ChevronUpIcon)
export const ChevronLeft = octicon(O.ChevronLeftIcon)
export const ChevronLeftIcon = ChevronLeft
export const ChevronRight = octicon(O.ChevronRightIcon)
export const ChevronRightIcon = ChevronRight
export const ChevronsUpDown = octicon(O.UnfoldIcon)
export const MoveHorizontal = octicon(O.ArrowBothIcon)
export const MoveVertical = octicon(O.ArrowBothIcon, "rotate-90")
export const Undo2 = octicon(O.UndoIcon)
export const RotateCcw = octicon(O.HistoryIcon)
export const RefreshCw = octicon(O.SyncIcon)
export const Repeat2 = octicon(O.LoopIcon)
export const ExternalLink = octicon(O.LinkExternalIcon)

/* text & layout */
export const AlignLeft = octicon(O.MoveToStartIcon)
export const AlignCenter = octicon(O.FocusCenterIcon)
export const AlignRight = octicon(O.MoveToEndIcon)
export const CaseUpper = octicon(O.HeadingIcon)
export const CaseLower = octicon(O.TypographyIcon)
export const CaseSensitive = octicon(O.BoldIcon)
export const Type = octicon(O.TypographyIcon)
export const TextCursorInput = octicon(O.SingleSelectIcon)
export const Minus = octicon(O.DashIcon)
export const Space = octicon(O.SpaceIcon)
export const Radius = octicon(O.SquareCircleIcon)
export const Rows3 = octicon(O.RowsIcon)
export const LayoutGrid = octicon(O.AppsIcon)
export const Frame = octicon(O.SquareIcon)
export const Square = octicon(O.SquareIcon)
export const Layers = octicon(O.StackIcon)
export const SlidersHorizontal = octicon(O.SlidersIcon)
export const ToggleRight = octicon(O.BooleanOnIcon)

/* objects & actions */
export const Bell = octicon(O.BellIcon)
export const BookOpen = octicon(O.BookIcon)
export const CalendarDays = octicon(O.CalendarIcon)
export const Clock = octicon(O.ClockIcon)
export const Clock3 = Clock
export const Code2 = octicon(O.CodeIcon)
export const Copy = octicon(O.CopyIcon)
export const Download = octicon(O.DownloadIcon)
export const Ellipsis = octicon(O.KebabHorizontalIcon)
export const Eye = octicon(O.EyeIcon)
export const FileBarChart = octicon(O.GraphIcon)
export const FilePlus2 = octicon(O.FileAddedIcon)
export const Filter = octicon(O.FilterIcon)
export const Gauge = octicon(O.MeterIcon)
export const ChartArea = octicon(O.GraphIcon)
export const GitBranch = octicon(O.GitBranchIcon)
export const GitPullRequestArrow = octicon(O.GitPullRequestIcon)
export const Globe = octicon(O.GlobeIcon)
export const KeyRound = octicon(O.KeyIcon)
export const Keyboard = octicon(O.CommandPaletteIcon)
export const Link2 = octicon(O.LinkIcon)
export const Link2Off = octicon(O.UnlinkIcon)
export const Lock = octicon(O.LockIcon)
export const LogOut = octicon(O.SignOutIcon)
export const Mail = octicon(O.MailIcon)
export const MessageSquarePlus = octicon(O.ChatAddIcon)
export const MessagesSquare = octicon(O.CommentDiscussionIcon)
export const Moon = octicon(O.MoonIcon)
export const Sun = octicon(O.SunIcon)
export const MousePointer2 = octicon(O.CursorIcon)
export const MousePointerClick = octicon(O.CursorIcon)
export const Navigation = octicon(O.LocationIcon)
export const PenTool = octicon(O.PencilIcon)
export const Pencil = octicon(O.PencilIcon)
export const Plus = octicon(O.PlusIcon)
export const ScanSearch = octicon(O.ZoomInIcon)
export const Search = octicon(O.SearchIcon)
export const SearchIcon = Search
export const Send = octicon(O.PaperAirplaneIcon)
export const Settings2 = octicon(O.GearIcon)
// variants: overlapping versions of one thing
export const Shapes = octicon(O.VersionsIcon)
export const Share = octicon(O.ShareIcon)
export const Share2 = octicon(O.ShareAndroidIcon)
export const Sparkles = octicon(O.SparkleFillIcon)
export const Wand2 = octicon(O.SparklesFillIcon)
export const Tag = octicon(O.TagIcon)
export const Terminal = octicon(O.TerminalIcon)
export const Trash2 = octicon(O.TrashIcon)
export const UserPlus = octicon(O.PersonAddIcon)
export const Users = octicon(O.PeopleIcon)
export const Workflow = octicon(O.WorkflowIcon)
export const Zap = octicon(O.ZapIcon)

/* properties panel */
export const EyeOff = octicon(O.EyeClosedIcon)
export const WrapText = octicon(O.WrapIcon)
export const PadX = octicon(O.ColumnsIcon)
export const PadY = octicon(O.RowsIcon)
export const Monitor = octicon(O.DeviceDesktopIcon)
