declare namespace LiveChat {
	interface RendererContent {
		authorBadges?: AuthorBadgeRenderer[]
		authorExternalChannelId: string
		authorName: SimpleText
		authorPhoto: {
			thumbnails: Thumbnail[]
			webThumbnailDetailsExtensionData?: {
				isPreloaded: boolean
			}
		}
		id: string
		timestampColor: integer	// replay
		timestampText?: SimpleText	// replay
		timestampUsec: string
		trackingParams: string	// streaming
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
			actionButton: ButtonRenderer
			icon: { iconType: "GIFT" }
			message: Runs
		 } | {
			contextMenuAccessibility: AccessibilityData
			contextMenuEndpoint: {
				commandMetadata: WebCommandMetadata
				liveChatItemContextMenuEndpoint: {
					param: string
				}
			}
			icon: { iconType: "POLL" }
			id: string
			message: Runs
		}
	}
	type SponsorshipsGiftPurchaseAnnouncementRenderer = {
		liveChatSponsorshipsGiftPurchaseAnnouncementRenderer: {
			authorExternalChannelId: string
			header: SponsorshipsHeaderRenderer
			id: string
			optInPrompt: ViewerEngagementMessageRenderer
			timestampUsec: string
		}
	}
	type SponsorshipsHeaderRenderer = {
		authorBudges: AuthorBadgeRenderer[]
		authorName: SimpleText
		contextMenuAccessibility: AccessibilityData
		contextMenuEndpoint: {
			clickTrackingParams: string
			commandMetadata: WebCommandMetadata
			liveChatItemContextMenuEndpoint: {
				param: string
			}
		}
		image: Thumbnail[]
		primaryText: Runs
	}
	type SponsorshipsGiftRedemptionAnnouncementRenderer = {
		liveChatSponsorshipsGiftRedemptionAnnouncementRenderer: RendererContent & {
			contextMenuAccessibility: AccessibilityData
			contextMenuEndpoint: {
				clickTrackingParams: string
				commandMetadata: WebCommandMetadata
				liveChatItemContextMenuEndpoint: {
					params: string
				}
			}
		}
	}
	type ModeChangeMessageRenderer = {
		liveChatModeChangeMessageRenderer: {
			icon: {
				iconType: string
			}
			id: string
			subtext: Runs
			text: Runs
			timestampText: SimpleText
			timestampUsec: string
		}
	}
	type PlaceholderItemRenderer = {
		liveChatPlaceholderItemRenderer: {
			id: string
			timestampUsec: string
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
	type ButtonRenderer = {
		buttonRenderer: {
			command: {
				browseEndpoint: {
					browseId: string
					navigationType: string
					param: string
				}
				clickTrackingPrams: string
				commandMetadata: {
					webCommandMetadata: {
						apiUrl: string
						sendPost: boolean
					}
				}
			}
			isDisabled: boolean
			size: string
			style: string
			text: Runs
		}
	}
	type Thumbnail = {
		url: string
		width?: number
		height?: number
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
		italics?: boolean
		navigationEndpoint?: {
			commandMetadata: WebCommandMetadata
			urlEndpoint: {
				url: string
				target: string
				nofollow: boolean
			}
		}
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
			shortcuts?: string[]
		}
	}
	type WebCommandMetadata = {
		webCommandMetadata: {
			// ViewerEngagementMessageRenderer | SponsorshipsHeaderRenderer | SponsorshipsGiftRedemptionAnnouncementRenderer
			ignoreNavigation?: boolean
			// ButtonRenderer
			apiUrl?: string
			sendPost?: boolean
			// Text
			url?: string
			webPageType?: string
			rootVe?: number
		}
	}
}

interface DocumentAndElementEventHandlersEventMap {
	"yt-action": CustomEvent<{
		actionName: string
		args: any[][]
	}>
}