import { getSerializedCID, loadIpfsFromCid } from './utils/appData'
import { calculateIpfsCidV0, pinJSONToIPFS } from './utils/ipfs'
import { AnyAppDataDocVersion, LatestAppDataDocVersion, IpfsHashInfo, GenerateAppDataDocParams } from './types'
import { CowError } from '../common/cow-error'
import { IpfsConfig } from '../common/configs'

const DEFAULT_APP_CODE = 'CowSwap'
const REFERRER_VERSION = '0.1.0'
const QUOTE_VERSION = '0.2.0'
const ORDER_CLASS_VERSION = '0.1.0'
const APP_DATA_VERSION = '0.5.0'

export class MetadataApi {
  /**
   * Creates an appDataDoc with the latest version format
   *
   * Without params creates a default minimum appData doc
   * Optionally creates metadata docs
   *
   * Example of result:
   * {
   *   "appCode": "CoW Swap",
   *   "environment": "local",
   *   "metadata": {
   *     "quote": {
   *       "slippageBips": "50",
   *       "version": "0.2.0"
   *     },
   *     "orderClass": {
   *       "orderClass": "market",
   *       "version": "0.1.0"
   *     }
   *   },
   *   "version": "0.5.0"
   * }
   */
  generateAppDataDoc(params?: GenerateAppDataDocParams): LatestAppDataDocVersion {
    const { appDataParams, metadataParams } = params || {}
    const { referrerParams, quoteParams, orderClassParams } = metadataParams || {}

    return {
      appCode: appDataParams?.appCode || DEFAULT_APP_CODE,
      environment: appDataParams?.environment,
      metadata: {
        ...(referrerParams ? { referrer: { ...referrerParams, version: REFERRER_VERSION } } : null),
        ...(quoteParams ? { quote: { ...quoteParams, version: QUOTE_VERSION } } : null),
        ...(orderClassParams ? { orderClass: { ...orderClassParams, version: ORDER_CLASS_VERSION } } : null),
      },
      version: APP_DATA_VERSION,
    }
  }

  async decodeAppData(hash: string): Promise<void | AnyAppDataDocVersion> {
    try {
      const cidV0 = await getSerializedCID(hash)
      if (!cidV0) throw new CowError('Error getting serialized CID')
      return loadIpfsFromCid(cidV0)
    } catch (e) {
      const error = e as CowError
      console.error('Error decoding AppData:', error)
      throw new CowError('Error decoding AppData: ' + error.message)
    }
  }

  async cidToAppDataHex(ipfsHash: string): Promise<string | void> {
    const { CID } = await import('multiformats/cid')

    const { digest } = CID.parse(ipfsHash).multihash
    return `0x${Buffer.from(digest).toString('hex')}`
  }

  async appDataHexToCid(hash: string): Promise<string | void> {
    const cidV0 = await getSerializedCID(hash)
    if (!cidV0) throw new CowError('Error getting serialized CID')
    return cidV0
  }

  /**
   * Calculates appDataHash WITHOUT publishing file to IPFS
   *
   * This method is intended to quickly generate the appDataHash independent
   * of IPFS upload/pinning
   * The hash is deterministic thus uploading it to IPFS will give you the same
   * result
   *
   * WARNING!
   * One important caveat is that - like `uploadMetadataDocToIpfs` method - the
   * calculation is done with a stringified file without a new line at the end.
   * That means that you will get different results if the file is uploaded
   * directly as a file. For example:
   *
   * Consider the content `hello world`.
   *
   * Using IPFS's cli tool to updload a file with the contents above
   * (`ipfs add file`), it'll have the line ending and result in this CIDv0:
   * QmT78zSuBmuS4z925WZfrqQ1qHaJ56DQaTfyMUF7F8ff5o
   *
   * While using this method - and `uploadMetadataDocToIpfs` - will give you
   * this CIDv0:
   * Qmf412jQZiuVUtdgnB36FXFX7xg5V6KEbSJ4dpQuhkLyfD
   *
   * @param appData
   */
  async calculateAppDataHash(appData: AnyAppDataDocVersion): Promise<IpfsHashInfo | void> {
    try {
      const cidV0 = await calculateIpfsCidV0(appData)
      const appDataHash = await this.cidToAppDataHex(cidV0)

      if (!appDataHash) {
        throw new CowError(`Could not extract appDataHash from calculated cidV0 ${cidV0}`)
      }

      return { cidV0, appDataHash }
    } catch (e) {
      const error = e as CowError
      throw new CowError('Failed to calculate appDataHash', error.message)
    }
  }

  async uploadMetadataDocToIpfs(appDataDoc: AnyAppDataDocVersion, ipfsConfig: IpfsConfig): Promise<string | void> {
    const { IpfsHash } = await pinJSONToIPFS(appDataDoc, ipfsConfig)
    return this.cidToAppDataHex(IpfsHash)
  }
}
