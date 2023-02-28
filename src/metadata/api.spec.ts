import fetchMock from 'jest-fetch-mock'
import { DEFAULT_IPFS_READ_URI, DEFAULT_IPFS_WRITE_URI } from '../common/ipfs'
import { MetadataApi } from './api'

const metadataApi = new MetadataApi()

const HTTP_STATUS_OK = 200
const HTTP_STATUS_INTERNAL_ERROR = 500

const DEFAULT_APP_DATA_DOC = {
  version: '0.5.0',
  appCode: 'CowSwap',
  metadata: {},
}

const IPFS_HASH = 'QmYNdAx6V62cUiHGBujwzeaB5FumAKCmPVeaV8DUvrU97F'
const APP_DATA_HEX = '0x95164af4bca0ce893339efb678065e705e16e2dc4e6d9c22fcb9d6e54efab8b2'

const PINATA_API_KEY = 'apikey'
const PINATA_API_SECRET = 'apiSecret'

const CUSTOM_APP_DATA_DOC = {
  ...DEFAULT_APP_DATA_DOC,
  environment: 'test',
  metadata: {
    referrer: {
      address: '0x1f5B740436Fc5935622e92aa3b46818906F416E9',
      version: '0.1.0',
    },
    quote: {
      slippageBips: '1',
      version: '0.2.0',
    },
  },
}

beforeEach(() => {
  fetchMock.resetMocks()
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe('Metadata api', () => {
  describe('generateAppDataDoc', () => {
    test('Creates appDataDoc with empty metadata ', () => {
      // when
      const appDataDoc = metadataApi.generateAppDataDoc({})
      // then
      expect(appDataDoc).toEqual(DEFAULT_APP_DATA_DOC)
    })

    test('Creates appDataDoc with custom metadata ', () => {
      // given
      const params = {
        appDataParams: {
          environment: CUSTOM_APP_DATA_DOC.environment,
        },
        metadataParams: {
          referrerParams: CUSTOM_APP_DATA_DOC.metadata.referrer,
          quoteParams: CUSTOM_APP_DATA_DOC.metadata.quote,
        },
      }
      // when
      const appDataDoc = metadataApi.generateAppDataDoc(params)
      // then
      expect(appDataDoc).toEqual(CUSTOM_APP_DATA_DOC)
    })
  })

  describe('uploadMetadataDocToIpfs', () => {
    test('Fails without passing credentials', async () => {
      // given
      const appDataDoc = metadataApi.generateAppDataDoc({
        metadataParams: {
          referrerParams: CUSTOM_APP_DATA_DOC.metadata.referrer,
        },
      })
      // when
      const promise = metadataApi.uploadMetadataDocToIpfs(appDataDoc, {})
      // then
      await expect(promise).rejects.toThrow('You need to pass IPFS api credentials.')
    })

    test('Fails with wrong credentials', async () => {
      // given
      fetchMock.mockResponseOnce(JSON.stringify({ error: { details: 'IPFS api keys are invalid' } }), {
        status: HTTP_STATUS_INTERNAL_ERROR,
      })
      const appDataDoc = metadataApi.generateAppDataDoc({})
      // when
      const promise = metadataApi.uploadMetadataDocToIpfs(appDataDoc, {
        pinataApiKey: PINATA_API_KEY,
        pinataApiSecret: PINATA_API_SECRET,
      })
      // then
      await expect(promise).rejects.toThrow('IPFS api keys are invalid')
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    test('Uploads to IPFS', async () => {
      // given
      fetchMock.mockResponseOnce(JSON.stringify({ IpfsHash: IPFS_HASH }), { status: HTTP_STATUS_OK })
      const appDataDoc = metadataApi.generateAppDataDoc({
        metadataParams: { referrerParams: CUSTOM_APP_DATA_DOC.metadata.referrer },
      })
      // when
      const appDataHex = await metadataApi.uploadMetadataDocToIpfs(appDataDoc, {
        pinataApiKey: PINATA_API_KEY,
        pinataApiSecret: PINATA_API_SECRET,
      })
      // then
      expect(appDataHex).toEqual(APP_DATA_HEX)
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(fetchMock).toHaveBeenCalledWith(DEFAULT_IPFS_WRITE_URI + '/pinning/pinJSONToIPFS', {
        body: JSON.stringify({ pinataContent: appDataDoc, pinataMetadata: { name: 'appData' } }),
        headers: {
          'Content-Type': 'application/json',
          pinata_api_key: PINATA_API_KEY,
          pinata_secret_api_key: PINATA_API_SECRET,
        },
        method: 'POST',
      })
    })
  })

  describe('decodeAppData', () => {
    test('Decodes appData', async () => {
      // given
      fetchMock.mockResponseOnce(JSON.stringify(CUSTOM_APP_DATA_DOC), { status: HTTP_STATUS_OK })
      // when
      const appDataDoc = await metadataApi.decodeAppData(APP_DATA_HEX)
      // then
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(fetchMock).toHaveBeenCalledWith(`${DEFAULT_IPFS_READ_URI}/${IPFS_HASH}`)
      expect(appDataDoc).toEqual(CUSTOM_APP_DATA_DOC)
    })

    test('Throws with wrong hash format', async () => {
      // given
      fetchMock.mockResponseOnce(JSON.stringify({}), { status: HTTP_STATUS_INTERNAL_ERROR })
      // when
      const promise = metadataApi.decodeAppData('invalidHash')
      // then
      await expect(promise).rejects.toThrow('Error decoding AppData: Incorrect length')
    })
  })

  describe('appDataHexToCid', () => {
    test('Happy path', async () => {
      // when
      const decodedAppDataHex = await metadataApi.appDataHexToCid(APP_DATA_HEX)
      // then
      expect(decodedAppDataHex).toEqual(IPFS_HASH)
    })

    test('Throws with wrong hash format ', async () => {
      // when
      const promise = metadataApi.appDataHexToCid('invalidHash')
      // then
      await expect(promise).rejects.toThrow('Incorrect length')
    })
  })

  describe('calculateAppDataHash', () => {
    test('Happy path', async () => {
      // when
      const result = await metadataApi.calculateAppDataHash(DEFAULT_APP_DATA_DOC)
      // then
      expect(result).not.toBeFalsy()
      expect(result).toEqual({ cidV0: IPFS_HASH, appDataHash: APP_DATA_HEX })
    })

    test('Throws when cannot derive the appDataHash', async () => {
      // given
      const mock = jest.fn()
      metadataApi.cidToAppDataHex = mock
      // when
      const promise = metadataApi.calculateAppDataHash(DEFAULT_APP_DATA_DOC)
      // then
      await expect(promise).rejects.toThrow('Failed to calculate appDataHash')
      expect(mock).toBeCalledTimes(1)
      expect(mock).toHaveBeenCalledWith(IPFS_HASH)
    })
  })
})