/** Purchase snapshots remain intact; only the wishlist presentation excludes them. */
export function isWishlistItem(item: {status: string}) { return item.status !== "purchased"; }
