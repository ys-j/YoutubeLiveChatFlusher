declare namespace LiveChat {
	interface RendererContent {
		authorBadges?: AuthorBadgeRenderer[]
		authorExternalChannelId: string
		authorName: SimpleText
		authorPhoto: {
			thumbnails: Thumbnail[]
		}
		id: string
		timestampUsec: string
		trackingParams: string
	}
	type AnyRenderer = TextMessageRenderer | MembershipItemRenderer | PaidMessageRenderer | PaidStickerRenderer | ViewerEngagementMessageRenderer;
	type TextMessageRenderer = {
		liveChatTextMessageRenderer: RendererContent & {
			message: Runs
			timestampText: SimpleText
		}
	};
	type MembershipItemRenderer = {
		liveChatMembershipItemRenderer: RendererContent & {
			headerPrimaryText?: Runs
			headerSubtext?: Runs | SimpleText
			message?: Runs
			timestampText?: SimpleText
		}
	}
	type PaidMessageRenderer = {
		liveChatPaidMessageRenderer: RendererContent & {
			authorNameTextColor: number
			bodyBackgroundColor: number
			bodyTextColor: number
			headerBackgroundColor: number
			headerTextColor: number
			message: Runs
			purchaseAmountText: SimpleText
			timestampColor: number
			timestampText?: SimpleText
		}
	}
	type PaidStickerRenderer = {
		liveChatPaidStickerRenderer: RendererContent & {
			authorNameTextColor: number
			backgroundColor: number
			moneyChipBackgroundColor: number
			moneyChipTextColor: number
			purchaseAmountText: SimpleText
			sticker: {
				thumbnails: Thumbnail[]
			}
			stickerDisplayHeight: number
			stickerDisplayWidth: number
		}
	}
	type ViewerEngagementMessageRenderer = {
		liveChatViewerEngagementMessageRenderer: {
			contextMenuAccessibility: AccessibilityData
			contextMenuEndpoint: {
				commandMetadata: {
					webCommandMetadata: {
						ignoreNavigation: boolean
					}
				}
				liveChatItemContextMenuEndpoint: {
					param: string
				}
			}
			icon: {
				iconType: string
			}
			id: string
			message: Runs
		}
	}
	type AuthorBadgeRenderer = {
		liveChatAuthorBadgeRenderer: {
			accessibility: AccessibilityData
			customThumbnail?: {
				thumbnails: Thumbnail[]
			}
			icon?: {
				iconType: string
			}
			tooltip: string
		}
	}
	type AccessibilityData = {
		accessibilityData: {
			label: string
		}
	}
	type Thumbnail = {
		url: string
		width: number
		height: number
	}
	type SimpleText = {
		simpleText: string
	}
	type Runs = {
		runs: (Text | Emoji)[]
	}
	type Text = {
		text: string
		bold?: boolean
	}
	type Emoji = {
		emoji: {
			emojiId: string
			image: {
				accessibility: AccessibilityData
				thumbnails: Thumbnail[]
			}
			isCustomEmoji: boolean
			searchTerms: string[]
			shortcuts: string[]
		}
	}
}

interface DocumentAndElementEventHandlersEventMap {
	"yt-action": CustomEvent<{
		actionName: string
		args: any[][]
	}>
}