import { serialize } from './utils'
import type { PersistOptions } from './types'
import { IStorageState } from './types'

export default function createPersist(config: PersistOptions) {
	// defaults
	const blacklist: string[] | null = config.blacklist || null
	const whitelist: string[] | null = config.whitelist || null
	const throttle = config.throttle || 0
	const storageKey = config.key
	const storage = config.storage

	const writeFailHandler = config.writeFailHandler || null

	// initialize stateful values
	let lastState: IStorageState = {}
	const stagedState: IStorageState = {}
	const keysToProcess: string[] = []
	let timeIterator: any = null
	let writePromise: Promise<any> | null = null

	const update = (state: IStorageState) => {
		// add any changed keys to the queue
		Object.keys(state).forEach((key) => {
			if (!passWhitelistBlacklist(key)) return // is keyspace ignored? noop
			if (lastState[key] === state[key]) return // value unchanged? noop
			if (keysToProcess.indexOf(key) !== -1) return // is key already queued? noop
			keysToProcess.push(key) // add key to queue
		})

		//if any key is missing in the new state which was present in the lastState,
		//add it for processing too
		Object.keys(lastState).forEach((key) => {
			if (
				state[key] === undefined &&
				passWhitelistBlacklist(key) &&
				keysToProcess.indexOf(key) === -1 &&
				lastState[key] !== undefined
			) {
				keysToProcess.push(key)
			}
		})

		// start the time iterator if not running (read: throttle)
		if (timeIterator === null) {
			timeIterator = setInterval(processNextKey, throttle)
		}

		lastState = state
	}

	function processNextKey() {
		if (keysToProcess.length === 0) {
			if (timeIterator) clearInterval(timeIterator)
			timeIterator = null
			return
		}

		const key = keysToProcess.shift()
		if (key === undefined) {
			return
		}
		const endState = lastState[key]

		if (endState !== undefined) {
			try {
				stagedState[key] = serialize(endState)
			} catch (err) {
				console.error('persist/createPersistoid: error serializing state', err)
			}
		} else {
			//if the endState is undefined, no need to persist the existing serialized content
			delete stagedState[key]
		}

		if (keysToProcess.length === 0) {
			writeStagedState()
		}
	}

	function writeStagedState() {
		// cleanup any removed keys just before write.
		Object.keys(stagedState).forEach((key) => {
			if (lastState[key] === undefined) {
				delete stagedState[key]
			}
		})

		writePromise = storage
			.setItem(storageKey, serialize(stagedState))
			.catch(onWriteFail)
	}

	function passWhitelistBlacklist(key: string) {
		if (whitelist && whitelist.indexOf(key) === -1 && key !== '_persist')
			return false
		if (blacklist && blacklist.indexOf(key) !== -1) return false
		return true
	}

	function onWriteFail(err: any) {
		// @TODO add fail handlers (typically storage full)
		if (writeFailHandler) writeFailHandler(err)
		if (err) {
			console.error('Error storing data', err)
		}
	}

	const flush = () => {
		while (keysToProcess.length !== 0) {
			processNextKey()
		}
		return writePromise || Promise.resolve()
	}

	const purge = () => {
		return storage.removeItem(storageKey)
	}

	// return `persistoid`
	return {
		update,
		flush,
		purge,
	}
}
