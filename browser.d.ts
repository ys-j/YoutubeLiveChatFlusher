/** Copyright 2021 _y_s */
/** @type integer */
type integer = number
declare namespace browser {
	namespace alarms {
		type Alarm = {
			name: string
			scheduledTime: number
			periodInMinutes?: number
		}
		function clear(name?: string): Promise<boolean>
		function clearAll(): Promise<boolean>
		function create(name?: string, alarmInfo?: { when?: number, delayInMinutes?: number, periodInMinutes?: number }): Promise<void>
		function get(name?: string): Promise<Alarm | undefined>
		function getAll(): Promise<Alarm[]>
		const onAlarm: events.Event<[alarm: Alarm]>
	}
	namespace bookmarks {
		type BookmarkTreeNode = {
			children?: BookmarkTreeNode[]
			dateAdded?: number
			dateGroupModified?: number
			id: string
			index?: integer
			parentId?: string
			title: string
			type?: BookmarkTreeNodeType
			unmodifiable?: BookmarkTreeNodeUnmodifiable
			url?: string
		}
		type BookmarkTreeNodeType = "bookmark" | "folder" | "separator"
		type BookmarkTreeNodeUnmodifiable = "managed"
		type CreateDetails = {
			index?: integer
			parentId?: string
			title?: string
			type?: BookmarkTreeNodeType
			url?: string
		}
		function create(bookmark: CreateDetails): Promise<BookmarkTreeNode>
		function get(idOrIdList: string | string[]): Promise<BookmarkTreeNode>
		function getChildren(id: string): Promise<BookmarkTreeNode>
		function getRecent(numberOfItems: integer): Promise<BookmarkTreeNode>
		function getSubTree(id: string): Promise<BookmarkTreeNode>
		function getTree(): Promise<BookmarkTreeNode>
		function move(id: string, destination: { parentId?: string, index?: integer }): Promise<BookmarkTreeNode>
		function remove(id: string): Promise<void>
		function removeTree(id: string): Promise<void>
		function search(query: string | { query?: string, url?: string, title?: string }): Promise<BookmarkTreeNode[]>
		function update(id: string, change: { title?: string, url?: string }): Promise<BookmarkTreeNode>
		const onCreated: events.Event<[id: string, bookmark: BookmarkTreeNode]>
		const onRemoved: events.Event<[id: string, removeInfo: { parentId: string, index: integer, node: BookmarkTreeNode }]>
		const onChanged: events.Event<[id: string, changeInfo: { title: string, url?: string }]>
		const onMoved: events.Event<[id: string, moveInfo: { parentId: string, index: integer, oldParentId: string, oldIndex: integer }]>
		const onChildrenReordered: events.Event<[id: string, reorderInfo: { childIds: string[] }]>
		const onImportBegan: events.Event
		const onImportEnded: events.Event
	}
	namespace browserAction {
		type ColorArray = [red: integer, green: integer, blue: integer, alpha: integer]
		type ImageDataType = ImageData
		function setTitle(details: { title: string | null, tabId?: integer, windowId?: integer }): Promise<void>
		function getTitle(details: { tabId?: integer, windowId?: integer }): Promise<string>
		function setIcon(details: {
			imageData?: ImageDataType | { [key: number]: ImageDataType }
			path?: string | { [key: number]: string }
			tabId?: integer
			windowId?: integer
		}): Promise<void>
		function setPopup(details: { tabId?: integer, windowId?: integer, popup: string | null }): Promise<void>
		function getPopup(details: { tabId?: integer, windowId?: integer }): Promise<string>
		function openPopup(): Promise<void>
		function setBadgeText(details: { text: string | null, tabId?: integer, windowId?: integer }): Promise<void>
		function getBadgeText(details: { tabId?: integer, windowId?: integer }): Promise<string>
		function setBadgeBackgroundColor(details: { color: string | ColorArray | null, tabId?: integer, windowId?: integer }): Promise<void>
		function getBadgeBackgroundColor(details: { tabId?: integer, windowId?: integer }): Promise<ColorArray>
		function setBadgeTextColor(details: { color: string | ColorArray | null, tabId?: integer, windowId?: integer }): Promise<void>
		function getBadgeTextColor(details: { tabId?: integer, windowId?: integer }): Promise<ColorArray>
		function enable(tabId?: integer): Promise<void>
		function disable(tabId?: integer): Promise<void>
		function isEnabled(details: { tabId?: integer, windowId?: integer }): Promise<boolean>
		const onClicked: events.Event<[
			tab: tabs.Tab,
			OnClickData: { modifiers: ("Shift" | "Alt" | "Command" | "Ctrl" | "MacCtrl")[], button: number }
		]>
	}
	namespace browserSettings {
		const allowPopupsForUserEvents: types.BrowserSetting<boolean>	// Firefox 57+
		const cacheEnabled: types.BrowserSetting<boolean>	// Firefox 56+
		const closeTabsByDoubleClick: types.BrowserSetting<boolean>	// Firefox 61+ (w/o Android)
		const contextMenuShowEvent: types.BrowserSetting<"mouseup" | "mousedown">	// Firefox 59+
		const ftpProtocolEnabled: types.BrowserSetting<boolean>	// Firefox 72+ (ro: 88+)
		const homepageOverride: types.BrowserSetting<string>	// Firefox 57+ (ro)
		const imageAnimationBehavior: types.BrowserSetting<"normal" | "none" | "once">	// Firefox 57+
		const newTabPageOverride: types.BrowserSetting<string>	// Firefox 57+ (ro)
		const newTabPosition: types.BrowserSetting<"afterCurrent" | "relatedAfterCurrent" | "atEnd">	// Firefox 61+
		const openBookmarksInNewTabs: types.BrowserSetting<boolean>	// Firefox 59+
		const openSearchResultsInNewTabs: types.BrowserSetting<boolean>	// Firefox 59+
		const openUrlbarResultsInNewTabs: types.BrowserSetting<boolean>	// Firefox 61+
		const overrideDocumentColors: types.BrowserSetting<"high-contrast-only" | "never" | "always" >	// Firefox 61+
		const useDocumentFonts: types.BrowserSetting<boolean>	// Firefox 61+
		const webNotificationsDisabled: types.BrowserSetting<boolean>;	// Firefox 58+
		const zoomFullPage: types.BrowserSetting<boolean>	// Firefox 75+ (w/o Android)
		const zoomSiteSpecific: types.BrowserSetting<boolean>	// Firefox 75+ (w/o Android)
	}
	namespace browsingData {
		type DataTypeSet = {
			cache?: boolean
			cookies?: boolean
			downloads?: boolean
			fileSystems?: boolean
			formData?: boolean
			history?: boolean
			indexedDB?: boolean
			localStorage?: boolean
			passwords?: boolean
			pluginData?: boolean
			serverBoundCertificates?: boolean
			serviceWorkers?: boolean
		}
		type RemovalOptions = {
			cookieStoreId?: string
			hostnames?: string[]
			originTypes?: { unprotectedWeb?: boolean, protectedWeb?: boolean, extension?: boolean }
			since?: number
		}
		function remove(removalOptions: RemovalOptions, dataTypes: DataTypeSet): Promise<void>
		function removeCache(removalOptions?: RemovalOptions): Promise<void>
		function removeCookies(removalOptions: RemovalOptions): Promise<void>
		function removeDownloads(removalOptions: RemovalOptions): Promise<void>
		function removeFormData(removalOptions: RemovalOptions): Promise<void>
		function removeHistory(removalOptions: RemovalOptions): Promise<void>
		function removeLocalStorage(removalOptions: RemovalOptions): Promise<void>
		function removePasswords(removalOptions: RemovalOptions): Promise<void>
		function removePluginData(removalOptions: RemovalOptions): Promise<void>
		function settings(): Promise<{ options: RemovalOptions, dataToRemove: DataTypeSet, dataRemovalPermitted: DataTypeSet }>
	}
	namespace captivePortal {
		const canonicalURL: string
		function getLastChecked(): Promise<integer>
		function getState(): Promise<"unknown" | "not_captive" | "unlocked_portal" | "locked_portal">
		const onConnectivityAvailable: events.Event<[status: "captive" | "clear"]>
		const onStateChanged: events.Event<[status: "unknown" | "not_captive" | "unlocked_portal" | "locked_portal"]>
	}
	namespace clipboard {
		function setImageData(imageData: ArrayBuffer, imageType: "png" | "jpeg"): Promise<void>
	}
	namespace commands {
		type Command = {
			name?: string
			description?: string
			shortcut?: string
		}
		function getAll(): Promise<Command[]>
		function reset(name: string): Promise<void>
		function update(details: { name: string, description?: string, shortcut?: string }): Promise<void>
		const onCommand: events.Event<[name: string]>
	}
	namespace contentScripts {
		type RegisteredContentScript = {
			destroy(): void
		}
		function register(contentScriptOptions: {
			allFrames?: boolean
			css?: { file?: string, code?: string }[]
			excludeGlobs?: string[]
			excludeMatches?: string[]
			includeGlobs?: string[]
			js?: { file?: string, code?: string }[]
			matchAboutBlank?: boolean
			matches: string[]
			runAt?: "document_start" | "document_end" | "document_idle"
		}): Promise<RegisteredContentScript>
	}
	namespace contextualIdentities {
		type ContextualIdentity = {
			cookieStoreId: string
			color: "blue" | "turquoise" | "green" | "yellow" | "orange" | "red" | "pink" | "purple" | "toolbar"
			colorCode: string
			icon: "fingerprint" | "briefcase" | "dollar" | "cart" | "circle" | "gift" | "vacation" | "food" | "fruit" | "pet" | "tree" | "chill" | "fence"
			iconUrl: string
			name: string
		}
		function create(details: { [key in "name" | "color" | "icon"]: ContextualIdentity[key] }): Promise<ContextualIdentity>
		function get(cookieStoreId: string): Promise<ContextualIdentity>
		function query(details: { name?: string }): Promise<ContextualIdentity[]>
		function update(cookieStoreId: string, details: { [ P in "name" | "color" | "icon"]?: ContextualIdentity[P] }): Promise<ContextualIdentity>
		function remove(cookieStoreId: string): Promise<ContextualIdentity>
		const onCreated: events.Event<[changeInfo: { contextualIdentity: ContextualIdentity }]>
		const onRemoved: events.Event<[changeInfo: { contextualIdentity: ContextualIdentity }]>
		const onUpdated: events.Event<[changeInfo: { contextualIdentity: ContextualIdentity }]>
	}
	namespace cookies {
		type Cookie = {
			domain: string
			expirationDate?: number
			firstPartyDomain: string
			hostOnly: boolean
			httpOnly: boolean
			name: string
			path: string
			sameSite: SameSiteStatus
			secure: boolean
			session: boolean
			storeId: string
			value: string
		}
		type CookieStore = {
			id: string
			incognito: boolean
			tabIds: integer[]
		}
		type OnChangedCause = "evicted" | "expired" | "explicit" | "expired_overwrite" | "overwrite"
		type SameSiteStatus = "no_restriction" | "lax" | "strict"
		interface CookieParams extends Partial<Cookie> { url: string }
		function get(details: { firstPartyDomain?: string, name: string, storeId?: string, url: string }): Promise<Cookie | null>
		function getAll(details: { [key in "domain" | "firstPartyDomain" | "name" | "path" | "secure" | "session" | "storeId" | "url"]: CookieParams[key] }): Promise<Cookie[]>
		function set(details: { [key in "domain" | "expirationDate" | "firstPartyDomain" | "httpOnly" | "name" | "path" | "sameSite" | "secure" | "storeId" | "url" | "value"]: CookieParams[key] }): Promise<Cookie>
		function remove(details: { firstPartyDomain?: string, name: string, storeId?: string, url: string }): Promise<Cookie | null>
		function getAllCookieStores(): Promise<CookieStore[]>
		const onChanged: events.Event<[changeInfo: { removed: boolean, cookie: Cookie, cause: OnChangedCause }]>
	}
	namespace devtools {
		namespace inspectedWindow {
			const tabId: integer
			function eval(expression: string, options?: {
				frameURL?: string
				useContentScriptContext?: boolean
				contextSecurityOrigin?: string
			}): Promise<[result: any, errorCause: { isException: true, value: string } | { isError: true, code: string }]>
			function reload(reloadOptions?: {
				ignoreCache?: boolean
				userAgent?: string
				injectedScript?: string
			}): Promise<void>
		}
		namespace network {
			interface HARData {
				log: HARLog
			}
			interface HARObject {
				comment?: string
				[key: string]: any // `key: _${string}`
			}
			interface HARLog extends HARObject {
				version: string
				creator: { name: string, version: string } & HARObject
				browser: { name: string, version: string } & HARObject
				pages: HARPage[]
				entries: HAREntry[]
			}
			interface HARPage extends HARObject {
				startedDateTime: string
				id: string
				title: string
				pageTimings: { onContentLoad?: number, onLoad?: number } & HARObject
			}
			interface HAREntry extends HARObject {
				pageref?: string
				startedDateTime: string
				time: number
				request: HARRequest
				response: HARResponse
				cache: { beforeRequest?: HARCache | null, afterRequest?: HARCache | null } & HARObject
				timings: { blocked?: number, dns?: number, connect?: number, send: number, wait: number, receive: number, ssl?: number } & HARObject
				serverIPAddress?: string
				connection?: string
			}
			interface HARRequest extends HARObject {
				method: string
				url: string
				httpVersion: string
				cookies: HARCookie[]
				headers: HARHeader[]
				queryString: HARQueryParam[]
				postData?: HARPostData
				headersSize: number
				bodySize: number
			}
			interface HARResponse extends HARObject {
				status: number
				statusText: string
				httpVersion: string
				cookies: HARCookie[]
				headers: HARHeader[]
				content: HARContent
				redirectURL: string
				headersSize: number
				bodySize: number
			}
			interface HARCookie extends HARObject {
				name: string
				value: string
				path?: string
				domain?: string
				expires?: string
				httpOnly?: boolean
				secure?: boolean
			}
			interface HARHeader extends HARObject {
				name: string
				value: string
			}
			interface HARQueryParam extends HARObject {
				name: string
				value: string
			}
			interface HARPostData extends HARObject {
				mimeType: string
				params: HARPostDataParam[]
				text: string
			}
			interface HARPostDataParam extends HARObject {
				name: string
				value?: string
				fileName?: string
				contentType?: string
			}
			interface HARContent extends HARObject {
				size: number
				compression?: number
				mimeType: string
				text?: string
				encoding?: string
			}
			interface HARCache extends HARObject {
				expires?: string
				lastAccess: string
				eTag: string
				hitCount: number
			}
			function getHAR(): Promise<HARData>
			const onNavigated: events.Event<[url: string]>
			const onRequestFinished: events.Event<[request: HAREntry]>
		}
		namespace panels {
			type Button = {
				update(iconPath: string, tooltipText: string, disabled: boolean): Promise<void>
				onClicked: events.Event
			}
			type ElementsPanel = {
				createSidebarPane(title: string): Promise<ExtensionSidebarPane>
				onSelectionChanged: events.Event
			}
			type ExtensionPanel = {
				onHidden: events.Event
				// onSearch: events.Event<(action: string, queryString: string) => void>
				onShown: events.Event
				// createStatusBarButton(iconPath: string, tooltipText: string, disabled: boolean): Promise<Button>
			}
			type ExtensionSidebarPane = {
				setExpression(expression: string, rootTitle?: string): Promise<void>
				// setHeight(height: string): Promise<void>
				setObject(jsonObject: string | any[] | Object, rootTitle?: string): Promise<void>
				setPage(extensionPageURL: string): Promise<void>
			}
			type SourcesPanel = {
				createSidebarPane(title: string): Promise<ExtensionSidebarPane>
				onSelectionChanged: events.Event
			}
			const elements: ElementsPanel
			// const sources: SourcesPanel
			const themeName: "light" | "dark" | "firebug" // chrome: "default" | "dark"
			function create(title: string, iconPath: string, pagePath: string): Promise<ExtensionPanel>
			// function openResource(url: string, lineNumber: integer): Promise<void>
			const onThemeChanged: events.Event<[themeName: "light" | "dark" | "firebug"]>
		}
	}
	namespace dns {
		type DNSRecord = {
			addresses: string[]
			canonicalName?: string
			isTRR: boolean
		}
		function resolve(
			hostname: string,
			flags?: ("allow_name_collisions" | "bypass_cache" | "canonical_name" | "disable_ipv4" | "disable_ipv6" | "disable_trr" | "offline" | "priority_low" | "priority_medium" | "speculate")[]
		): Promise<DNSRecord>
	}
	namespace downloads {
		type FilenameConflictAction = "uniquify" | "overwrite" | "prompt"
		type InterruptReason =
		// File-related errors:
		"FILE_FAILED" | "FILE_ACCESS_DENIED" | "FILE_NO_SPACE" | "FILE_NAME_TOO_LONG" | "FILE_TOO_LARGE" | "FILE_VIRUS_INFECTED" | "FILE_TRANSIENT_ERROR" | "FILE_BLOCKED" | "FILE_SECURITY_CHECK_FAILED" | "FILE_TOO_SHORT"
		// Network-related errors:
		| "NETWORK_FAILED" | "NETWORK_TIMEOUT" | "NETWORK_DISCONNECTED" | "NETWORK_SERVER_DOWN" | "NETWORK_INVALID_REQUEST"
		// Server-related errors:
		| "SERVER_FAILED" | "SERVER_NO_RANGE" | "SERVER_BAD_CONTENT" | "SERVER_UNAUTHORIZED" | "SERVER_CERT_PROBLEM" | "SERVER_FORBIDDEN"
		// User-related errors:
		| "USER_CANCELED" | "USER_SHUTDOWN"
		// Miscellaneous:
		| "CRASH"
		type DangerType = "file" | "url" | "content" | "uncommon" | "host" | "unwanted" | "safe" | "accepted"
		type State = "in_progress" | "interrupted" | "complete"
		type DownloadItem = {
			byExtensionId?: string
			byExtensionName?: string
			bytesReceived: number
			canResume: boolean
			danger: DangerType
			endTime?: string
			error?: InterruptReason
			estimatedEndTime?: string
			exists: boolean
			filename: string
			fileSize: number
			id: integer
			incognito: boolean
			mime: string
			paused: boolean
			referrer: string
			startTime: string
			state: State
			totalBytes: number
			url: string
		}
		interface Delta<T> {
			current?: T
			previous?: T
		}
		type DownloadTime = Date | string | number
		type DownloadQuery = {
			query?: (Exclude<keyof DownloadItem | `-${keyof DownloadItem}`, "filename" | "url" | "-filename" | "-url">)[]
			startedBefore?: DownloadTime
			startedAfter?: DownloadTime
			endedBefore?: DownloadTime
			endedAfter?: DownloadTime
			totalBytesGreater?: number
			totalBytesLess?: number
			filenameRegex?: string
			urlRegex?: string
			limit?: integer
			orderBy?: (keyof DownloadItem | `-${keyof DownloadItem}`)[]
		} & {
			[key in "id" | "url" | "filename" | "danger" | "mime" | "startTime" | "endTime" | "bytesReceived" | "totalBytes" | "fileSize" | "exists"]?: DownloadItem[key]
		}
		function download(option: {
			allowHttpErrors?: boolean
			body?: string
			conflictAction?: FilenameConflictAction
			filename?: string
			headers?: ({ name: string, value: string } | { name: string, binaryValue: ArrayBuffer })[]
			incognito?: boolean
			method?: "GET" | "POST"
			saveAs?: boolean
			url: string
		}): Promise<DownloadItem["id"] | InterruptReason>
		function search(query: DownloadQuery): Promise<DownloadItem[]>
		function pause(downloadId: DownloadItem["id"]): Promise<void>
		function resume(downloadId: DownloadItem["id"]): Promise<void>
		function cancel(downloadId: DownloadItem["id"]): Promise<void>
		function getFileIcon(downloadId: DownloadItem["id"], options?: { size?: integer }): Promise<string>
		function open(downloadId: DownloadItem["id"]): Promise<void>
		function show(downloadId: DownloadItem["id"]): Promise<boolean>
		function showDefaultFolder(): Promise<void>
		function erase(query: DownloadQuery): Promise<DownloadItem["id"][]>
		function removeFile(downloadId: DownloadItem["id"]): Promise<void>
		function acceptDanger(downloadId: DownloadItem["id"]): Promise<void>
		// function setShelfEnabled(enabled: boolean): Promise<void>
		const onCreated: events.Event<[downloadItem: DownloadItem]>
		const onErased: events.Event<[downloadId: DownloadItem["id"]]>
		const onChanged: events.Event<[downloadDelta: { id: DownloadItem["id"] } & {
			[key in "url" | "filename" | "danger" | "mime" | "startTime" | "endTime" | "state" | "canResume" | "paused" | "error" | "totalBytes" | "fileSize" | "exists"]?: Delta<DownloadItem[key]>
		}]>
	}
	namespace events {
		type Event<T extends any[] = [], U = void, V extends any[] = []> = {
			addListener(callback: (...args: T) => U, ...extraArgs: V): void
			// addRules(eventName: string, webViewInstanceId: number, rules: Rule[], callback: (rules: Rule[]) => void): void
			// getRules(eventName: string, webViewInstanceId: number, callback: (rules: Rule[]) => void): void
			// getRules(eventName: string, webViewInstanceId: number, ruleIdentifiers: string[], callback: (rules: Rule[]) => void): void
			hasListener(listener: (...args: T) => U): boolean
			// hasListeners(): boolean
			removeListener(listener: (...args: T) => U): void
			// removeRules(eventName: string, webViewInstanceId: number, ruleIdentifiers: string[], callback: (rules: Rule[]) => void): void
		}
		type Rule = {
			id?: string
			tags?: string[]
			conditions: any[]
			actions: any[]
			priority?: number
		}
		type UrlFilter = {
			hostContains?: string
			hostEquals?: string
			hostPrefix?: string
			hostSuffix?: string
			pathContains?: string
			pathEquals?: string
			pathPrefix?: string
			pathSuffix?: string
			queryContains?: string
			queryEquals?: string
			queryPrefix?: string
			querySuffix?: string
			urlContains?: string
			urlEquals?: string
			urlMatches?: string
			originAndPathMatches?: string
			urlPrefix?: string
			urlSuffix?: string
			schemes?: string[]
			ports?: (integer | [from: integer, to: integer])[]
		}
	}
	namespace extension {
		type ViewType = "tab" | "popup" | "sidebar"
		/** @alias browser.runtime.lastError */
		const lastError: Error | null
		const inIncognitoContext: boolean
		/** @alias browser.runtime.getBackgroundPage */
		function getBackgroundPage(): Window
		function getViews(fetchProperties?: {
			type?: ViewType
			windowId?: integer
		}): Window[]
		function isAllowedIncognitoAccess(): Promise<boolean>
		function isAllowedFileSchemeAccess(): Promise<boolean>
		function setUpdateUrlData(data: string): void
	}
	namespace extensionTypes {
		type ImageDetails = {
			format?: ImageFormat
			quality?: number
			rect?: { [key in "x" | "y" | "width" | "height"]: integer }
			scale?: number
		}
		type ImageFormat = "jpeg" | "png"
		type InjectDetails = {
			allFrames?: boolean
			code?: string
			cssOrigin?: CSSOrigin // unavailable in executeScript
			file?: string
			frameId?: integer
			matchAboutBlank?: boolean
			runAt?: RunAt // unavailable in removeCSS
		}
		type RunAt = "document_start" | "document_end" | "document_idle"
		type CSSOrigin = "user" | "author"
	}
	namespace find {
		interface RangeData {
			framePos: integer
			startTextNodePos: integer
			endTextNodePos: integer
			startOffset: integer
			endOffset: integer
		}
		interface RectData {
			rectsAndTexts: {
				rectList: { [key in "top" | "left" | "bottom" | "right"]: integer }[]
				textList: string[]
			}
			text: string
		}
		function find(queryphrase: string, options?: {
			tabId?: integer
			caseSensitive?: boolean
			entireWord?: boolean
			includeRangeData?: boolean
			includeRectData?: boolean
		}): Promise<{
			count: integer
			rangeData?: RangeData[]
			rectData?: RectData[]
		}>
		function highlightResults(options?: {
			tabId?: integer
			rangeIndex?: integer
			noScroll?: boolean
		}): Promise<void>
		function removeHighlighting(): Promise<void>
	}
	namespace history {
		type TransitionType = "link" | "typed" | "auto_bookmark" | "auto_subframe" | "manual_subframe" | "generated" | "auto_toplevel" | "form_submit" | "reload" | "keyword" | "keyword_generated"
		type HistoryItem = {
			id: string
			url?: string
			title?: string
			lastVisitTime?: number
			visitCount?: integer
			typedCount?: integer
		}
		type VisitItem = {
			id: HistoryItem["id"]
			visitId: string
			visitTime?: number
			referringVisitId: string
			transition: TransitionType
		}
		function search(query: {
			text: string
			startTime?: number | string | Date
			endTime?: number | string | Date
			maxResults?: integer
		}): Promise<HistoryItem[]>
		function getVisits(details: { url: string }): Promise<VisitItem[]>
		function addUrl(details: {
			url: string
			title?: string
			transition?: TransitionType
			visitTime?: number | string | Date
		}): Promise<void>
		function deleteUrl(details: { url: string }): Promise<void>
		function deleteRange(details: {
			startTime: number | string | Date
			endTime: number | string | Date
		}): Promise<void>
		function deleteAll(): Promise<void>
		const onTitleChanged: events.Event<[url: string, title: string]>
		const onVisited: events.Event<[result: HistoryItem]>
		const onVisitRemoved: events.Event<[removed: { allHistory: boolean, urls: string[] }]>
	}
	namespace i18n {
		type LanguageCode = string
		function getAcceptLanguages(): Promise<LanguageCode[]>
		function getMessage(messageName: string, substitutions?: string | string[]): string
		function getUILanguage(): LanguageCode
		function detectLanguage(text: string): Promise<{ isReliable: boolean, languages: { language: LanguageCode, percentage: number }[]}>
	}
	namespace identity {
		function getRedirectURL(): string
		function launchWebAuthFlow(details: {
			url: string
			redirect_uri?: string
			interactive: boolean
		}): Promise<string>
	}
	namespace idle {
		type IdleState = "active" | "idle" | "locked"
		function queryState(detectionIntervalInSeconds: number): Promise<IdleState>
		function setDetectionInterval(intervalInSeconds: number): void
		const onStateChanged: events.Event<[newState: IdleState]>
	}
	namespace management {
		type ExtensionInfo = {
			description: string
			// disabledReason: "unknown" | "permissions_increase"
			enabled: boolean
			homepageUrl: string
			hostPermissions: string[]
			icons: { size: number, url: string }[]
			id: string
			installType: "admin" | "development" | "normal" | "sideload" | "other"
			mayDisable: boolean
			name: string
			// offlineEnabled: boolean
			optionsUrl: string
			permissions: string[]
			shortName: string
			type: "extension" | "hosted_app" | "packaged_app" | "legacy_packaged_app" | "theme"
			updateUrl: string
			version: string
			// versionName: string
		}
		function getAll(): Promise<ExtensionInfo[]>
		function get(id: string): Promise<ExtensionInfo>
		function getSelf(): Promise<ExtensionInfo>
		function install(options: { url: string }): Promise<{ id: string }>
		// function uninstall(id: string, options?: { showConfirmDialog?: boolean }): Promise<void>
		function uninstallSelf(options?: {
			showConfirmDialog?: boolean
			// dialogMessage: string
		}): Promise<void>
		// function getPermissionWarningsById(id: string): Promise<string[]>
		// function getPermissionWarningsByManifest(manifestString: string): Promise<string[]>
		function setEnabled(id: string, enabled: boolean): Promise<void>
		const onInstalled: events.Event<[info: ExtensionInfo]>
		const onUninstalled: events.Event<[info: ExtensionInfo]>
		const onEnabled: events.Event<[info: ExtensionInfo]>
		const onDisabled: events.Event<[info: ExtensionInfo]>
	}
	namespace menus {
		type ContextType = "all" | "audio" | "bookmark" | "browser_action" | "editable" | "frame" | "image" | "link" | "page" | "page_action" | "password" | "selection" | "tab" | "tools_menu" | "video"
		type ItemType = "normal" | "checkbox" | "radio" | "separator"
		type OnClickData = {
			bookmarkId?: string
			button?: integer
			checked?: boolean
			editable: boolean
			frameId?: integer
			frameUrl?: string
			linkText?: string
			mediaType?: "image" | "video" | "audio"
			menuItemId: integer | string
			modifiers: ("Alt" | "Command" | "Ctrl" | "MacCtrl" | "Shift")[]
			pageUrl?: string
			parentMenuItemId?: integer | string
			selectionText?: string
			srcUrl?: string
			targetElementId?: integer
			viewType?: extension.ViewType
			wasChecked?: boolean
		}
		const ACTION_MENU_TOP_LEVEL_LIMIT: 6
		function create(createProperties: {
			checked?: boolean
			command?: "_execute_browser_action" | "_execute_page_action" | "_execute_sidebar_action"
			contexts?: ContextType[]
			documentUrlPatterns?: string[]
			enabled?: boolean
			icons?: { [key: string]: string }
			id?: string
			onclick?: (info: OnClickData, tab: tabs.Tab) => void
			parentId?: integer | string
			targetUrlPatterns?: string[]
			title?: string
			type?: ItemType
			viewTypes?: extension.ViewType
			visible?: boolean
		}, callback: () => void): integer | string
		function getTargetElement(targetElementId: OnClickData["targetElementId"]): Element
		function overrideContext(contextOptions: { showDefaults: boolean } | { context: "bookmark", bookmarkId: string } | { context: "tab", tabId: integer }): Promise<void>
		function refresh(): Promise<void>
		function remove(menuItemId: integer | string): Promise<void>
		function removeAll(): Promise<void>
		function update(id: integer | string, updateProperties: {
			checked?: boolean
			command?: "_execute_browser_action" | "_execute_page_action" | "_execute_sidebar_action"
			contexts?: ContextType[]
			documentUrlPatterns?: string[]
			enabled?: boolean
			icons?: { [key: string]: string }
			id?: string
			onclick?: (info: OnClickData, tab: tabs.Tab) => void
			parentId?: integer | string
			targetUrlPatterns?: string[]
			title?: string
			type?: ItemType
			viewTypes?: extension.ViewType
			visible?: boolean
		}): Promise<void>
		const onClicked: events.Event<[info: OnClickData, tab: tabs.Tab]>
		const onHidden: events.Event
		const onShown: events.Event<[info: { contexts: ContextType[], menuIds: (integer | string)[] }
			& { [key in "editable" | "frameId"]: OnClickData[key] }
			& { [key in "bookmarkId" | "button" | "checked" | "frameUrl" | "linkText" | "mediaType" | "pageUrl" | "parentMenuItemId" | "selectionText" | "srcUrl" | "targetElementId" | "viewType" | "wasChecked"]?: OnClickData[key]
		}, tab: tabs.Tab]>
	}
	namespace notifications {
		type NotificationOptions = {
			type: TemplateType
			message: string
			title: string
			iconUrl?: string
			contextMessage?: string
			priority?: 0 | 1 | 2
			eventTime?: number
			// buttons?: { title: string, iconUrl?: string }[]
			// imageUrl: string
			// items: { title: string, message: string }[]
			// progress: number
		}
		type TemplateType = "basic"// | "image" | "list" | "progress"
		function clear(id: string): Promise<boolean>
		function create(id: string, options: NotificationOptions): Promise<string>
		function create(options: NotificationOptions): Promise<string>
		function getAll(): Promise<{ [key: string]: NotificationOptions }>
		// function update(id: string, options: NotificationOptions): Promise<boolean>
		const onButtonClicked: events.Event<[notificationId: string, buttonIndex: integer]>
		const onClicked: events.Event<[notificationId: string]>
		const onClosed: events.Event<[notificationId: string]> // byUser: boolean
		const onShown: events.Event<[notificationId: string]>
	}
	namespace omnibox {
		type OnInputEnteredDisposition = "currentTab" | "newForegroundTab" | "newBackgroundTab"
		type SuggestResult = {
			content: string
			description: string
		}
		function setDefaultSuggestion(suggestion: { description: string }): void
		const onInputStarted: events.Event
		const onInputChanged: events.Event<[text: string, suggest: (suggestions: SuggestResult[]) => void]>
		const onInputEntered: events.Event<[text: SuggestResult["content"], disposition: OnInputEnteredDisposition]>
		const onInputCancelled: events.Event
	}
	namespace pageAction {
		type ImageDataType = ImageData
		function show(id: integer): Promise<void>
		function hide(id: integer): Promise<void>
		function isShown(details: { tabId: integer }): Promise<boolean>
		function setTitle(details: { tabId: integer, title: string | null }): Promise<void>
		function getTitle(details: { tabId: integer }): Promise<string>
		function setIcon(details: {
			imageData?: ImageDataType | { [key: number]: ImageData }
			path?: string | { [key: number]: string }
			tabId: integer
		}): Promise<void>
		function setPopup(details: { tabId: integer, popup: string | null }): Promise<void>
		function getPopup(details: { tabId: integer }): Promise<string>
		function openPopup(): Promise<void>
		const onClicked: events.Event<[tab: tabs.Tab, onClickData: { modifiers: ("Shift" | "Alt" | "Command" | "Ctrl" | "MacCtrl")[], button: integer }]>
	}
	namespace permissions {
		type Permissions = {
			origins?: string[]
			permissions?: string[]
		}
		function contains(permissions: Permissions): Promise<boolean>
		function getAll(): Promise<Permissions>
		function remove(permissionts: Permissions): Promise<boolean>
		function request(permissions: Permissions): Promise<boolean>
		const onAdded: events.Event<[permissions: Permissions]>
		const onRemoved: events.Event<[permissions: Permissions]>
	}
	namespace privacy {
		interface _NetworkSettingsTypes {
			networkPredictionEnabled: boolean
			peerConnectionEnabled: boolean
			webRTCIPHandlingPolicy: "default" | "default_public_and_private_interfaces" | "default_public_interface_only" | "disable_non_proxied_udp" |"proxy_only"
			httpsOnlyMode: "always" | "never" | "private_browsing"
		}
		interface _ServicesSettingsTypes {
			passwordSavingEnabled: boolean
		}
		interface _WebsitesSettingsTypes {
			cookieConfig: {
				behavior: "allow_all" | "reject_all" | "reject_third_party" | "allow_visited" | "reject_trackers" | "reject_trackers_and_partition_foreign"
				nonPersistentCookies: boolean
			}
			firstPartyIsolate: boolean
			hyperlinkAuditingEnabled: boolean
			protectedContentEnabled: boolean
			referrersEnabled: boolean
			resistFingerprinting: boolean
			thirdPartyCookiesAllowed: boolean
			trackingProtectionMode: boolean
		}
		const network: { [key in keyof _NetworkSettingsTypes]: types.BrowserSetting<_NetworkSettingsTypes[key]> }
		const services: { [key in keyof _ServicesSettingsTypes]: types.BrowserSetting<_ServicesSettingsTypes[key]> }
		const websites: { [key in keyof _WebsitesSettingsTypes]: types.BrowserSetting<_WebsitesSettingsTypes[key]> }
	}
	namespace proxy {
		type ProxyInfo = {
			type: "direct" | "http" | "https" | "socks" | "socks4"
			host?: string
			port?: string
			username?: string
			password?: string
			proxyDNS?: boolean
			failoverTimeout: number
			proxyAuthorizationHeader: string
			connectionIsolationKey?: string
		}
		type RequestDetails = {
			cookieStoreId: string
			documentUrl: string
			frameId: integer
			fromCache: boolean
			incognito: boolean
			method: "GET" | "HEAD" | "POST" | "PUT" | "DELETE" | "CONNECT" | "OPTIONS" | "TRACE" | "PATCH"
			originUrl: string
			parentFrameId: integer
			requestId: string
			requestHeaders?: webRequest.HttpHeaders
			tabId: integer
			thirdParty: boolean
			timeStamp: number
			type: webRequest.ResourceType
			url: string
		}
		interface _SettingsTypes {
			autoConfigUrl: string
			autoLogin: boolean
			http: string
			httpProxyAll: boolean
			passthrough: string
			proxyDNS: boolean
			proxyType: "none" | "autoDetect" | "system" | "manual" | "autoConfig"
			socks: string
			socksVersion: 4 | 5
			ssl: string
		}
		const settings: { [key in keyof _SettingsTypes]?: types.BrowserSetting<_SettingsTypes[key]> }
		const onError: events.Event<[newState: Error]>
		const onRequest: events.Event<[requestInfo: RequestDetails], ProxyInfo | ProxyInfo[] | Promise<ProxyInfo> | Promise<ProxyInfo[]>, [filter: webRequest.RequestFilter, extraInfoSpec?: string[]]>
	}
	namespace runtime {
		type Port<T = MessageSender | undefined> = {
			disconnect(): Promise<void>
			postMessage(message: {}): Promise<void>
			error: Error
			name: string
			sender: T
			onDisconnect: events.Event<[port: Port]>
			onMessage: events.Event<[message: object]>
		}
		type MessageSender = {
			tab?: tabs.Tab
			frameId?: integer
			id?: string
			url?: string
			tlsChannelId?: string
		}
		type PlatformOs = "mac" | "win" | "android" | "cros" | "linux" | "openbsd"
		type PlatformArch = "arm" | "x86-32" | "x86-64"
		type PlatformNaclArch = "arm" | "x86-32" | "x86-64"
		type PlatformInfo = {
			os: PlatformOs
			arch: PlatformArch
			nacl_arch: PlatformNaclArch
		}
		type RequestUpdateCheckStatus = "throttled" | "no_update" | "update_available"
		type OnInstalledReason = "install" | "update" | "browser_update" | "shared_module_update"
		type OnRestartRequiredReason = "app_update" | "os_update" | "periodic"
		const lastError: Error | null
		const id: string
		function getBackgroundPage(): Promise<Window>
		function openOptionsPage(): Promise<void>
		function getManifest(): { [key: string]: any }
		function getURL(path: string): string
		function setUninstallURL(url: string): Promise<void>
		function reload(): void
		function requestUpdateCheck(): Promise<[status: RequestUpdateCheckStatus, details?: { version: string }]>
		function connect(extensionId?: string, connectInfo?: { name?: string, includeTlsChannelId?: boolean }): Port
		function connectNative(application: string): Port
		function sendMessage(extensionId: string, message: any, options?: { includeTlsChannelId?: boolean }): Promise<any>
		function sendMessage(message: any, options?: { includeTlsChannelId?: boolean }): Promise<any>
		function sendNativeMessage(application: string, message: object): Promise<any>
		function getPlatformInfo(): Promise<PlatformInfo>
		function getBrowserInfo(): Promise<{ [key in "name" | "vendor" | "version" | "buildID"]: string }>
		// function getPackageDirectoryEntry(): Promise<DirectoryEntry>
		const onStartup: events.Event
		const onInstalled: events.Event<[details: { id?: string, previousVersion?: string, reason: OnInstalledReason, temporary: boolean }]>
		// const onSuspend: events.Event
		// const onSuspendCanceled: events.Event
		const onUpdateAvailable: events.Event<[details: { version: string }]>
		const onConnect: events.Event<[port: Required<Port<Required<MessageSender>>>]>
		const onConnectExternal: events.Event<[port: Required<Port<Required<MessageSender>>>]>
		const onMessage: events.Event<[message: object, sender: MessageSender, sendResponse: (message: object) => any], void | boolean | Promise<any>>
		const onMessageExternal: events.Event<[message: object, sender: MessageSender, sendResponse: (message: object) => any], void | boolean | Promise<any>>
		// const onRestartRequired: events.Event<[reason: OnRestartRequiredReason]>
	}
	namespace search {
		function get(): Promise<{
			name: string
			isDefault: boolean
			alias?: string
			favIconUrl?: string
		}[]>
		function search(searchProperties: {
			query: string
			engine?: string
			tabId?: integer
		}): void
	}
	namespace sessions {
		type Filter = {
			maxResults: integer
		}
		type Session = {
			lastModified: number
			tab: tabs.Tab	// "tabs" permission or host permissions required
			window?: windows.Window
		}
		const MAX_SESSION_RESULTS = 25
		function forgetClosedTab(windowId: integer, sessionId: string): Promise<void>
		function forgetClosedWindow(sessionId: string): Promise<void>
		function getRecentlyClosed(filter?: Filter): Promise<Session[]>
		function restore(sessionId: string): Promise<Session>
		function setTabValue(tabId: integer, key: string, value: string | object | null): Promise<void>
		function getWindowValue(windowId: integer, key: string): Promise<string | object | null | undefined>
		function removeWindowValue(windowId: integer, key: string): Promise<void>
		const onChanged: events.Event
	}
	namespace sidebarAction {
		type ImageDataType = ImageData
		function close(): Promise<void>
		function getPanel(details: { tabId?: integer, windowId?: integer }): Promise<string>
		function getTitle(details: { tabId?: integer, windowId?: integer }): Promise<string>
		function isOpen(details: { windowId?: integer }): Promise<boolean>
		function open(): Promise<void>
		function setIcon(details: {
			imageData?: ImageDataType | { [key: number]: string }[]
			path?: string | { [key: number]: string }[]
			tabId?: integer
			windowId?: integer
		}): Promise<void>
		function setPanel(details: { panel: string | null, tabId?: integer, windowId?: integer }): Promise<void>
		function setTitle(details: { title: string | null, tabId?: integer, windowId?: integer }): Promise<void>
		function toggle(): Promise<void>
	}
	namespace storage {
		type StorageArea = {
			get(keys?: string | string[] | null): Promise<{ [key: string]: any }>
			get(defaultValues: { [key: string]: any }): Promise<{ [key: string]: any }>
			getBytesInUse(keys?: string | string[] | null): Promise<integer>
			set(keys: object): Promise<void>
			remove(keys?: string | string[] | null): Promise<{ [key: string]: any }>
			clear(): Promise<void>
		}
		type StorageChange = {
			oldValue?: any
			newValue?: any
		}
		const sync: StorageArea
		const local: StorageArea
		const managed: Pick<StorageArea, "get">
		const onChanged: events.Event<[changes: { [key: string]: StorageChange }, areaName: "sync" | "local" | "managed"]>
	}
	namespace tabs {
		type MutedInfoReason = "capture" | "extension" | "user"
		type MutedInfo = { extensionId?: string, muted: boolean, reason: MutedInfoReason }
		type PageSettings = { [key in "edgeBottom" | "edgeLeft" | "edgeRight" | "edgeTop" | "marginBottom" | "marginLeft" | "marginRight" | "marginTop" | "paperHeight" | "paperWidth" | "scaling"]?: number }
		& { [key in "footerCenter" | "footerLeft" | "footerRight" | "headerCenter" | "headerLeft" | "headerRight" | "toFileName"]?: string }
		& { [key in "showBackgroundColors" | "showBackgroundImages" | "shrinkToFit"]?: boolean  }
		& { [key in "orientation" | "paperSizeUnit"]?: 0 | 1 }
		type Tab = {
			active: boolean
			attention?: boolean
			audible?: boolean
			// autoDiscardable?: boolean
			cookieStoreId?: string
			discarded?: boolean
			favIconUrl?: string
			height?: integer
			hidden: boolean
			highlighted: boolean
			id: integer
			incognito: boolean
			index: integer
			isArticle: boolean
			isInReaderMode: boolean
			lastAccessed: number
			mutedInfo?: MutedInfo
			openerTabId?: integer
			pinned: boolean
			sessionId?: string
			status?: TabStatus
			successorTabId?: integer
			title: string	// "tabs" permission or host permissions required
			url: string	// "tabs" permission or host permissions required
			width: integer
			windowId: integer
		}
		type TabStatus = "loading" | "complete"
		type WindowType = "normal" | "popup" | "panel" | "devtools"
		type ZoomSettingsMode = "automatic" | "disabled" | "manual"
		type ZoomSettingsScope = "per-origin" | "per-tab"
		type ZoomSettings = {
			defaultZoomFactor?: number
			mode?: ZoomSettingsMode
			scope?: ZoomSettingsScope
		}
		const TAB_ID_NONE: integer // dummy type
		function captureTab(tabId?: integer, options?: extensionTypes.ImageDetails): Promise<string>
		function captureVisibleTab(windowId?: integer, options?: extensionTypes.ImageDetails): Promise<string>
		function connect(tabId: integer, connectInfo?: { name?: string, frameId?: integer }): Required<runtime.Port>
		function create(createProperties: {
			active?: boolean
			cookieStoreId?: string
			discarded?: boolean
			index?: integer
			openerTabId?: integer
			openInReaderMode?: boolean
			pinned?: boolean
			title?: string
			url?: string
			windowId?: integer
		}): Promise<Tab>
		function detectLanguage(tabId?: integer, callback?: (languageCode: i18n.LanguageCode) => void): i18n.LanguageCode 
		function discard(tabIds: integer | integer[]): Promise<void>
		function duplicate(tabId: integer, duplicateProperties?: { index?: integer, active?: boolean }): Promise<Tab>
		interface _ExecuteScriptDetails extends extensionTypes.InjectDetails {
			cssOrigin: undefined
		}
		function executeScript(tabId: integer, details: Omit<extensionTypes.InjectDetails, "cssOrigin">): Promise<object[]>
		function executeScript(details: Omit<extensionTypes.InjectDetails, "cssOrigin">): Promise<object[]>
		function get(tabId: integer): Promise<Tab>
		function getCurrent(): Promise<Tab>
		function getZoom(tabId?: integer): Promise<number>
		function getZoomSettings(tabId?: integer): Promise<ZoomSettings>
		function goForward(tabId?: integer, callback?: () => void): Promise<void>
		function goBack(tabId?: integer, callback?: () => void): Promise<void>
		function highlight(highlightInfo: { windowId?: integer, populate?: boolean, tabs: integer[] }): Promise<windows.Window>
		function insertCSS(tabId: integer, details: extensionTypes.InjectDetails): Promise<void>
		function insertCSS(details: extensionTypes.InjectDetails): Promise<void>
		function move(tabId: integer, moveProperties: { windowId: integer, index: integer }): Promise<integer>
		function move(tabIds: integer[], moveProperties: { windowId: integer, index: integer }): Promise<integer[]>
		function moveInSuccession(tabIds: integer[], tabId?: integer, options?: { append: boolean, insert: boolean }): Promise<void>
		function print(): void
		function printPreview(): Promise<void>
		function query(queryObj: {
			active?: boolean
			audible?: boolean
			autoDiscardable?: boolean
			cookieStoreId?: string
			currentWindow?: boolean
			discarded?: boolean
			hidden?: boolean
			highlighted?: boolean
			index?: integer
			muted?: boolean
			lastFocusedWindow?: boolean
			pinned?: boolean
			status?: TabStatus
			title?: string
			url?: string | string[]
			windowId?: integer
			windowType?: WindowType
		}): Promise<tabs.Tab[]>
		function reload(tabId: integer, reloadProperties?: { bypassCache?: boolean }): Promise<void>
		function reload(reloadProperties?: { bypassCache?: boolean }): Promise<void>
		function remove(tabIds: integer | integer[]): Promise<void>
		function removeCSS(tabId: integer, details: extensionTypes.InjectDetails): Promise<void>
		function removeCSS(details: extensionTypes.InjectDetails): Promise<void>
		function saveAsPDF(pageSettings: PageSettings): Promise<"saved" | "replaced" | "canceled" | "not_saved" | "not_replaced">
		function setZoom(tabId: integer, zoomFactor: number): Promise<void>
		function setZoom(zoomFactor: number): Promise<void>
		function setZoomSettings(tabId: integer, zoomSettings: ZoomSettings): Promise<void>
		function setZoomSettings(zoomSettings: ZoomSettings): Promise<void>
		function toggleReaderMode(tabId?: integer): Promise<void>
		function update(tabId: integer, updateProperties: {
			active?: boolean
			autoDiscardable?: boolean
			highlighted?: boolean
			loadReplace?: boolean
			muted?: boolean
			openerTabId?: integer
			pinned?: boolean
			successorTabId?: integer
			url?: string
		}): Promise<Tab>
		function update(updateProperties: {
			active?: boolean
			autoDiscardable?: boolean
			highlighted?: boolean
			loadReplace?: boolean
			muted?: boolean
			openerTabId?: integer
			pinned?: boolean
			successorTabId?: integer
			url?: string
		}): Promise<Tab>
		function warmup(tabId: integer): Promise<void>
		const onActivated: events.Event<[activeInfo: { previousTabId: integer, tabId: integer, windowId: integer }]>
		const onAttached: events.Event<[tabId: integer, attachInfo: { newWindowId: integer, newPosition: integer }]>
		const onCreated: events.Event<[tab: Tab]>
		const onDetached: events.Event<[tabId: integer, detachInfo: { oldWindowId: integer, oldPosition: integer }]>
		const onHighlighted: events.Event<[highlightInfo: { windowId: integer, tabIds: integer[] }]>
		const onMoved: events.Event<[tabId: integer, moveInfo: { windowId: integer, fromIndex: integer, toIndex: integer }]>
		const onRemoved: events.Event<[tabId: integer, removeInfo: { windowId: integer, isWindowClosing: boolean }]>
		const onReplaced: events.Event<[addedTabId: integer, removedTabId: integer]>
		const onUpdated: events.Event<[tabId: integer, changeInfo: {
			attention?: boolean
			audible?: boolean
			discarded?: boolean
			favIconUrl?: string
			hidden?: boolean
			isArticle?: boolean
			mutedInfo?: MutedInfo
			pinned?: boolean
			status?: TabStatus
			title?: string
			url?: string
		}, tab: Tab], void, [extraParameters?: {
			urls: string[]
			properties: ("attention" | "audible" | "discarded" | "favIconUrl" | "hidden" | "isArticle" | "mutedInfo" | "pinned" | "sharingState" | "status" | "title" | "url")[]
			tabId: integer
			windowId: integer
		}]>
		const onZoomChange: events.Event<[ZoomChangeInfo: { tabId: integer, oldZoomFactor: number, newZoomFactor: number, zoomSettings: ZoomSettings }]>
	}
	namespace theme {
		type Theme = {
			images?: {
				theme_frame?: string
				additional_backgrounds?: string[]
			}
			colors: {
				[key in "bookmark_text" | "button_background_active" | "button_background_hover" | "icons" | "icons_attention" | "frame" | "frame_inactive" | "ntp_background" | "ntp_text" | `${"popup" | "sidebar"}${"" | "_border" | "_highlight" | "_highlight_text" | "_text"}` | "tab_background_separator" | "tab_background_text" | "tab_line" | "tab_loading" | "tab_selected" | "tab_text" | "toolbar" | "toolbar_bottom_separator" | "toolbar_field" | "toolbar_field_border" | "toolbar_field_border_focus" | "toolbar_field_focus" | "toolbar_field_highlight" | "toolbar_field_highlight_text" | "toolbar_field_separator" | "toolbar_field_text" | "toolbar_field_text_focus" | "toolbar_text" | "toolbar_top_separator" | "toolbar_vertical_separator"]: string | [red: integer, green: integer, blue: integer]
			}
			properties?: {
				additional_backgrounds_alignment: ("bottom" | "center" | "left" | "right" | "top" | `${"center" | "left" | "right"} ${"bottom" | "center" | "top"}`)[]
				additional_backgrounds_tiling: ("no-repeat" | "repeat" | "repeat-x" | "repeat-y")[]
			}
		}
		function getCurrent(windowId?: integer): Promise<Theme>
		function update(windowId: integer, theme: Theme): void
		function update(theme: Theme): void
		function reset(windowId?: integer): void
		const onUpdated: events.Event<[updateInfo: { theme: Theme, windowId: integer }]>
	}
	namespace topSites {
		type MostVisitedURL = {
			favicon?: string
			title: string
			url: string
		}
		function get(options: {
			includeBlocked?: boolean
			includeFavicon?: boolean
			includePinned?: boolean
			includeSearchShortcuts?: boolean
			limit?: integer
			newtab: boolean
			onePerDomain?: boolean
		}): Promise<MostVisitedURL[]>
	}
	namespace types {
		type BrowserSetting<T> = {
			clear(details: {}): Promise<boolean>
			get(details: {}): Promise<{
				value: T
				levelOfControl: "not_controllable" | "controlled_by_other_extensions" | "controllable_by_this_extension" | "controlled_by_this_extension"
			}>
			set(details: { value: T }): Promise<boolean>
			onChange: events.Event<[
				details: {
					value: T
					levelOfControl: "not_controllable" | "controlled_by_other_extensions" | "controllable_by_this_extension" | "controlled_by_this_extension"
				}
			]>
		}
	}
	namespace userScripts {
		type RegisteredUserScript = {
			unregister(): Promise<void>
		}
		function register(userScriptOptions: {
			scriptMetadata?: object
			allFrames?: boolean
			excludeGlobs?: string[]
			excludeMatches?: string[]
			includeGlobs?: string[]
			js: ({ file: string } | { code: string })[]
			matchAboutBlank?: boolean
			matches: string[]
			runAt?: extensionTypes.RunAt
		}): Promise<RegisteredUserScript>
		const onBeforeScript: events.Event<[script: { defineGlobals: object, export: any, global: object, metadata: object }]>
	}
	namespace webNavigation {
		type TransitionType = "link" | "typed" | "auto_bookmark" | "auto_subframe" | "manual_subframe" | "generated" | "start_page" | "form_submit" | "reload" | "keyword" | "keyword_generated"
		type TransitionQualifier = "client_redirect" | "server_redirect" | "forward_back" | "from_address_bar"
		function getFrame(details: {
			tabId: integer
			processId?: integer
			frameId: integer
		}): Promise<{
			errorOccurred: boolean
			url: string
			parentFrameId: integer
		}>
		function getAllFrames(details: { tabId: integer }): Promise<{
			errorOccurred: boolean
			processId: integer
			frameId: integer
			parentFrameId: integer
			url: string
		}>
		interface _WebNavigationEvent<U extends keyof _WebNavigationEventCallbackDetails> extends events.Event<[details: {
			[key in U]: _WebNavigationEventCallbackDetails[key]
		}], void, [filter?: { url: events.UrlFilter[] }]> {}
		interface _WebNavigationEventCallbackDetails {
			tabId: integer
			url: string
			processId: integer
			frameId: integer
			parentFrameId: integer
			timeStamp: number
			transitionType: TransitionType
			transitionQualifiers: TransitionQualifier[]
			error: string
			sourceFrameId: integer
			sourceProcessId: integer
			sourceTabId: integer
			windowId: integer
			replacedTabId: integer
		}
		const onBeforeNavigate: _WebNavigationEvent<"tabId" | "url" | "frameId" | "parentFrameId" | "timeStamp">
		const onCommitted: _WebNavigationEvent<"tabId" | "url" | "processId" | "frameId" | "parentFrameId" | "timeStamp" | "transitionType" | "transitionQualifiers">
		const onDOMContentLoaded: _WebNavigationEvent<"tabId" | "url" | "processId" | "frameId" | "timeStamp">
		const onCompleted: _WebNavigationEvent<"tabId" | "url" | "processId" | "frameId" | "timeStamp">
		const onErrorOccurred: _WebNavigationEvent<"tabId" | "url" | "processId" | "frameId" | "timeStamp" | "error">
		const onCreatedNavigationTarget: _WebNavigationEvent<"sourceFrameId" | "sourceProcessId" | "sourceTabId" | "tabId" | "timeStamp" | "url" | "windowId">
		const onReferenceFragmentUpdated: _WebNavigationEvent<"tabId" | "url" | "processId" | "frameId" | "timeStamp" | "transitionType" | "transitionQualifiers">
		const onTabReplaced: _WebNavigationEvent<"replacedTabId" | "tabId" | "timeStamp">
		const onHistoryStateUpdated: _WebNavigationEvent<"tabId" | "url" | "processId" | "frameId" | "timeStamp" | "transitionType" | "transitionQualifiers">
	}
	namespace webRequest {
		type BlockingResponse = {
			authCredentials?: { username: string, password: string }
			cancel?: boolean
			redirectUrl?: string
			requestHeaders?: HttpHeaders
			responseHeaders?: HttpHeaders
			upgradeToSecure?: boolean
		}
		type CertificateInfo = {
			fingerprint: { sha1: string, sha256: string }
			isBuiltInRoot: boolean
			issuer: string
			rawDER: number[]
			serialNumber: string
			subject: string
			subjectPublicKeyInfoDigest: { sha256: string }
			validity: { start: number, end: number }
		}
		type HttpHeaders = ({ name: string, value: string } | { name: string, binaryValue: integer[] })[]
		type RequestFilter = {
			urls: string[]
			types?: ResourceType[]
			tabId?: integer
			windowId?: integer
			incognito?: boolean
		}
		type ResourceType = "beacon" | "csp_report" | "font" | "image" | "imageset" | "main_frame" | "media" | "object" | "object_subrequest" | "ping" | "script" | "speculative" | "stylesheet" | "sub_frame" | "web_manifest" | "websocket" | "xbl" | "xml_dtd" | "xmlhttprequest" | "xslt" | "other"
		type SecurityInfo = {
			certificates: CertificateInfo[]
			certificateTransparencyStatus?: "not_applicable" | "policy_compliant" | "policy_not_enough_scts" | "policy_not_diverse_scts"
			cipherSuite?: string
			errorMessage?: string
			hpkp?: boolean
			hsts?: boolean
			isDomainMismatch?: boolean
			isExtendedValidation?: boolean
			isNotValidAtThisTime?: boolean
			isUntrusted?: boolean
			keaGroupName?: string
			protocolVersion?: "TLSv1" | "TLSv1.1" | "TLSv1.2" | "TLSv1.3" | "unknown"
			signatureSchemeName?: string
			state: "broken" | "insecure" | "secure" | "weak"
			weaknessReasons?: "cipher"
		}
		type StreamFilter = {
			close(): void
			disconnect(): void
			resume(): void
			suspend(): void
			write(data: Uint8Array | ArrayBuffer): void
			ondata: (event: { data: Uint8Array | ArrayBuffer }) => void
			onerror: (event: { data: Uint8Array | ArrayBuffer }) => void
			onstart: (event: { data: Uint8Array | ArrayBuffer }) => void
			onstop: (event: { data: Uint8Array | ArrayBuffer }) => void
			error: string | null
			status: "uninitialized" | "transferringdata" | "finishedtransferringdata" | "suspended" | "closed" | "disconnected" | "failed"
		}
		type UploadData = {
			bytes?: ArrayBuffer
			file?: string
		}
		const MAX_HANDLER_BEHAVIOR_CHANGED_CALLS_PER_10_MINUTES: number
		function handlerBehaviorChanged(): Promise<void>
		function filterResponseData(requestId: string): StreamFilter
		function getSecurityInfo(requestId: string, options: { certificateChain?: boolean, rawDER?: boolean }): Promise<SecurityInfo>
		interface _WebRequestEventListenerDetails {
			challenger: { host: string, port: integer }
			cookieStoreId: string
			documentUrl: string
			error: string
			frameAncestors: { url: string, frameId: integer }[]
			frameId: integer
			fromCache: boolean
			incognito: boolean
			ip: string
			isProxy: boolean
			method: "GET" | "HEAD" | "POST" | "PUT" | "DELETE" | "CONNECT" | "OPTIONS" | "TRACE" | "PATCH"
			originUrl: string
			parentFrameId: integer
			proxyInfo: { host: string, port: integer, type: "http" | "https" | "socks" | "socks4" | "direct" | "unknown", username: string, proxyDNS: boolean, failoverTimeout: number }
			realm: string | undefined
			redirectUrl: string
			requestBody: { error?: string, formData?: { [key: string]: any }, raw?: UploadData[] } | undefined
			requestHeaders: HttpHeaders | undefined
			requestId: string
			scheme: "basic" | "digest"
			statusCode: integer
			statusLine: string
			tabId: integer
			thirdParty: boolean
			timeStamp: number
			type: ResourceType
			url: string
			urlClassification: { [key in "firstParty" | "thirdParty"]: (
				"fingerprinting" | "fingerprinting_content"
				| "cryptomining" | "cryptomining_content"
				| "tracking" | "tracking_ad" | "tracking_analytics" | "tracking_social" | "tracking_content"
				| "any_basic_tracking" | "any_strict_tracking" | "any_social_tracking"
				)[] }
		}
		interface _WebRequestBlockingEventListener<T extends keyof _WebRequestEventListenerDetails, U = BlockingResponse | Promise<BlockingResponse>, V extends any[] = [filter: RequestFilter, extraInfoSpec?: ("blocking" | "requestBody")[]]> extends events.Event<[details: { [key in T]: _WebRequestEventListenerDetails[key] }], U, V> {}
		interface _WebRequestNotBlockingEventListener<T extends keyof _WebRequestEventListenerDetails, U = void, V extends any[] = [filter: RequestFilter, extraInfoSpec?: "requestBody"[]]> extends events.Event<[details: { [key in T]: _WebRequestEventListenerDetails[key] }], U, V> {}
		const onBeforeRequest: _WebRequestBlockingEventListener<"cookieStoreId" | "documentUrl" | "frameAncestors" | "frameId" | "incognito" | "method" | "originUrl" | "parentFrameId" | "proxyInfo" | "requestBody" | "requestId" | "tabId" | "thirdParty" | "timeStamp" | "type" | "url" | "urlClassification">
		const onBeforeSendHeaders: _WebRequestBlockingEventListener<"cookieStoreId" | "documentUrl" | "frameId" | "incognito" | "method" | "originUrl" | "parentFrameId" | "proxyInfo" | "requestHeaders" | "requestId" | "tabId" | "thirdParty" | "timeStamp" | "type" | "url" | "urlClassification", BlockingResponse>
		const onSendHeaders: _WebRequestNotBlockingEventListener<"cookieStoreId" | "documentUrl" | "frameId" | "incognito" | "method" | "originUrl" | "parentFrameId" | "proxyInfo" | "requestHeaders" | "requestId" | "tabId" | "thirdParty" | "timeStamp" | "type" | "url" | "urlClassification">
		const onHeadersReceived: _WebRequestBlockingEventListener<"cookieStoreId" | "documentUrl" | "frameAncestors" | "frameId" | "fromCache" | "incognito" | "ip" | "method" | "originUrl" | "parentFrameId" | "proxyInfo" | "requestHeaders" | "requestId" | "statusCode" | "statusLine" | "tabId" | "thirdParty" | "timeStamp" | "type" | "url" | "urlClassification">
		const onAuthRequired: _WebRequestBlockingEventListener<"challenger" | "cookieStoreId" | "frameId" | "incognito" | "isProxy" | "method" | "parentFrameId" | "proxyInfo" | "realm" | "requestHeaders" | "requestId" | "scheme" | "statusCode" | "statusLine" | "tabId" | "thirdParty" | "timeStamp" | "type" | "url" | "urlClassification">
		const onResponseStarted: _WebRequestNotBlockingEventListener<"cookieStoreId" | "documentUrl" | "frameId" | "fromCache" | "incognito" | "ip" | "method" | "originUrl" | "parentFrameId" | "proxyInfo" | "requestHeaders" | "requestId" | "statusCode" | "statusLine" | "tabId" | "thirdParty" | "timeStamp" | "type" | "url" | "urlClassification">
		const onBeforeRedirect: _WebRequestNotBlockingEventListener<"cookieStoreId" | "documentUrl" | "frameId" | "fromCache" | "incognito" | "ip" | "method" | "originUrl" | "parentFrameId" | "proxyInfo" | "redirectUrl" | "requestHeaders" | "requestId" | "statusCode" | "statusLine" | "tabId" | "thirdParty" | "timeStamp" | "type" | "url" | "urlClassification">
		const onCompleted: _WebRequestNotBlockingEventListener<"cookieStoreId" | "documentUrl" | "frameId" | "fromCache" | "incognito" | "ip" | "method" | "originUrl" | "parentFrameId" | "proxyInfo" | "requestHeaders" | "requestId" | "statusCode" | "statusLine" | "tabId" | "thirdParty" | "timeStamp" | "type" | "url" | "urlClassification">
		const onErrorOccurred: _WebRequestNotBlockingEventListener<"cookieStoreId" | "documentUrl"| "error" | "frameId" | "fromCache" | "incognito" | "ip" | "method" | "originUrl" | "parentFrameId" | "proxyInfo" | "requestId" | "tabId" | "thirdParty" | "timeStamp" | "type" | "url" | "urlClassification", void, [filter: RequestFilter]>
	}
	namespace windows {
		type WindowType = "normal" | "popup" | "panel" | "devtools"
		type WindowState = "normal" | "minimized" | "maximized" | "fullscreen" | "docked"
		type Window = {
			alwaysOnTop: boolean
			focused: boolean
			height?: integer
			id: integer // | undefined 
			incognito: boolean
			left?: integer
			sessionId?: string
			state?: windows.WindowState
			tabs?: tabs.Tab[]
			readonly title?: string
			top?: integer
			type?: WindowType
			width?: integer
		}
		type CreateType = "normal" | "popup" | "panel" | "detached_panel"
		const WINDOW_ID_NONE: integer // dummy type
		const WINDOW_ID_CURRENT: integer
		function get(windowId: integer, getInfo?: { populate?: boolean }): Promise<Window>
		function getCurrent(getInfo?: { populate?: boolean }): Promise<Window>
		function getLastFocused(getInfo?: { populate?: boolean }): Promise<Window>
		function getAll(getInfo?: { populate?: boolean }): Promise<Window>
		function create(createData?: {
			allowScriptsToClose?: boolean
			cookieStoreId?: integer
			focused?: boolean
			height?: integer
			incognito?: boolean
			left?: integer
			state?: WindowState
			tabId?: integer
			titlePreface?: string
			top?: integer
			type?: CreateType
			url?: string | string[]
			width?: integer
		}): Promise<Window>
		function update(windowId: integer, updateInfo: {
			drawAttention?: boolean
			focused?: boolean
			height?: integer
			left?: integer
			state?: WindowState
			titlePreface?: string
			top?: integer
			width?: integer
		}): Promise<Window>
		function remove(windowId: integer): Promise<void>
		const onCreated: events.Event<[window: Window]>
		const onRemoved: events.Event<[windowId: integer]>
		const onFocusChanged: events.Event<[windowId: integer]>
	}
}
declare var chrome: typeof browser;
declare namespace content {
	const WebSocket: WebSocket
	const XMLHttpRequest: XMLHttpRequest
	const fetch: WindowOrWorkerGlobalScope['fetch']
}