import type { CompressionHistoryJob } from './types';

const DB_NAME = 'crush-history';
const DB_VERSION = 1;
const STORE_NAME = 'jobs';

export async function loadHistoryJobs(): Promise<CompressionHistoryJob[]> {
	const db = await openHistoryDb();

	try {
		const transaction = db.transaction(STORE_NAME, 'readonly');
		const request = transaction.objectStore(STORE_NAME).getAll() as IDBRequest<
			CompressionHistoryJob[]
		>;
		const jobs = await requestToPromise(request);
		await waitForTransaction(transaction);

		return jobs.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, 10);
	} finally {
		db.close();
	}
}

export async function saveHistoryJob(job: CompressionHistoryJob): Promise<void> {
	const db = await openHistoryDb();

	try {
		const transaction = db.transaction(STORE_NAME, 'readwrite');
		transaction.objectStore(STORE_NAME).put(job);
		await waitForTransaction(transaction);
	} finally {
		db.close();
	}
}

export async function clearHistoryJobs(): Promise<void> {
	const db = await openHistoryDb();

	try {
		const transaction = db.transaction(STORE_NAME, 'readwrite');
		transaction.objectStore(STORE_NAME).clear();
		await waitForTransaction(transaction);
	} finally {
		db.close();
	}
}

function openHistoryDb(): Promise<IDBDatabase> {
	if (typeof indexedDB === 'undefined') {
		return Promise.reject(new Error('IndexedDB is not available in this browser.'));
	}

	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);

		request.onupgradeneeded = () => {
			const db = request.result;

			if (!db.objectStoreNames.contains(STORE_NAME)) {
				db.createObjectStore(STORE_NAME, { keyPath: 'id' });
			}
		};

		request.onsuccess = () => {
			resolve(request.result);
		};

		request.onerror = () => {
			reject(request.error ?? new Error('Could not open local history.'));
		};
	});
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		request.onsuccess = () => {
			resolve(request.result);
		};

		request.onerror = () => {
			reject(request.error ?? new Error('IndexedDB request failed.'));
		};
	});
}

function waitForTransaction(transaction: IDBTransaction): Promise<void> {
	return new Promise((resolve, reject) => {
		transaction.oncomplete = () => {
			resolve();
		};

		transaction.onerror = () => {
			reject(transaction.error ?? new Error('IndexedDB transaction failed.'));
		};

		transaction.onabort = () => {
			reject(transaction.error ?? new Error('IndexedDB transaction was aborted.'));
		};
	});
}
