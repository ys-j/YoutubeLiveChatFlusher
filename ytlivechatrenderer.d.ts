namespace LiveChat {
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
	type TextMessageRenderer = {
		liveChatTextMessageRenderer: {
			authorBadges?: AuthorBadgeRenderer[]
			authorExternalChannelId: string
			authorName: SimpleText
			authorPhoto: {
				thumbnails: Thumbnail[]
			}
			id: string
			message: Runs
			timestampText: SimpleText
			timestampUsec: string
			trackingParams: string
		}
	};
	type MembershipItemRenderer = {
		liveChatMembershipItemRenderer: {
			authorBadges: AuthorBadgeRenderer[]
			authorExternalChannelId: string
			authorName: SimpleText
			authorPhoto: {
				thumbnails: Thumbnail[]
			}
			headerPrimaryText?: Runs
			headerSubtext?: Runs | SimpleText
			id: string
			message?: Runs
			timestampText?: SimpleText
			timestampUsec: string
			trackingParams: string
		}
	}
	type PaidMessageRenderer = {
		liveChatPaidMessageRenderer: {
			authorBadges?: AuthorBadgeRenderer[]
			authorExternalChannelId: string
			authorName: SimpleText
			authorNameTextColor: number
			authorPhoto: {
				thumbnails: Thumbnail[]
			}
			bodyBackgroundColor: number
			bodyTextColor: number
			headerBackgroundColor: number
			headerTextColor: number
			id: string
			message: Runs
			purchaseAmountText: SimpleText
			timestampColor: number
			timestampText?: SimpleText
			timestampUsec: string
			trackingParams: string
		}
	}
	type PaidStickerRenderer = {
		liveChatPaidStickerRenderer: {
			authorBadges?: AuthorBadgeRenderer[]
			authorExternalChannelId: string
			authorName: SimpleText
			authorNameTextColor: number
			authorPhoto: {
				thumbnails: Thumbnail[]
			}
			backgroundColor: number
			id: string
			moneyChipBackgroundColor: number
			moneyChipTextColor: number
			purchaseAmountText: SimpleText
			sticker: {
				thumbnails: Thumbnail[]
			}
			stickerDisplayHeight: number
			stickerDisplayWidth: number
			timestampUsec: string
			trackingParams: string
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
		accessibilityData: { label: string }
	}
	type Thumbnail = {
		url: string
		width: number
		height: number
	}
	type SimpleText = { simpleText: string }
	type Runs = {
		runs: (Text | Emoji)[]
	}
	type Text = { text: string }
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