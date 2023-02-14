import {
  Address,
  BaseHttpRequest,
  CancelablePromise,
  DefaultService,
  OpenAPIConfig,
  OrderBookClient,
  OrderCancellation,
  OrderCreation,
  OrderPostError,
  OrderQuoteRequest,
  OrderQuoteResponse,
  Trade,
  TransactionHash,
  UID,
} from './generated'
import { CowError } from '../common/cow-error'
import { SupportedChainId } from '../common/chains'
import { EnvConfig, PROD_CONFIG, STAGING_CONFIG } from '../common/configs'
import { transformOrder } from './transformOrder'
import { EnrichedOrder } from './types'
import { ApiRequestOptions } from './generated/core/ApiRequestOptions'
import { request as __request } from './generated/core/request'

class FetchHttpRequest extends BaseHttpRequest {
  constructor(config: OpenAPIConfig) {
    super(config)
  }

  /**
   * Request method
   * @param options The request options from the service
   * @returns CancelablePromise<T>
   * @throws ApiError
   */
  public override request<T>(options: ApiRequestOptions): CancelablePromise<T> {
    return __request(this.config, {
      ...options,
      headers: {
        ...options.headers,
        'Content-Type': 'application/json',
      },
    })
  }
}

export class OrderBookApi {
  private envConfig: EnvConfig
  private service: DefaultService

  constructor(chainId: SupportedChainId, env: 'prod' | 'staging' = 'prod') {
    this.envConfig = (env === 'prod' ? PROD_CONFIG : STAGING_CONFIG)[chainId]

    this.service = new OrderBookClient({ BASE: this.envConfig.apiUrl }, FetchHttpRequest).default
  }

  getTrades({ owner, orderId }: { owner?: Address; orderId?: UID }): CancelablePromise<Array<Trade>> {
    if (owner && orderId) {
      return new CancelablePromise((_, reject) => {
        reject(new CowError('Cannot specify both owner and orderId'))
      })
    }

    return this.service.getApiV1Trades(owner, orderId)
  }

  getOrders({
    owner,
    offset = 0,
    limit = 1000,
  }: {
    owner: Address
    offset?: number
    limit?: number
  }): Promise<Array<EnrichedOrder>> {
    return this.service.getApiV1AccountOrders(owner, offset, limit).then((orders) => {
      return orders.map(transformOrder)
    })
  }

  getTxOrders(txHash: TransactionHash): Promise<Array<EnrichedOrder>> {
    return this.service.getApiV1TransactionsOrders(txHash).then((orders) => {
      return orders.map(transformOrder)
    })
  }

  getOrder(uid: UID): Promise<EnrichedOrder> {
    return this.service.getApiV1Orders(uid).then((order) => {
      return transformOrder(order)
    })
  }

  getQuote(requestBody: OrderQuoteRequest): CancelablePromise<OrderQuoteResponse> {
    return this.service.postApiV1Quote(requestBody)
  }

  sendSignedOrderCancellation(uid: UID, requestBody: OrderCancellation): CancelablePromise<void> {
    return this.service.deleteApiV1Orders1(uid, requestBody)
  }

  sendOrder(requestBody: OrderCreation): Promise<UID> {
    return this.service.postApiV1Orders(requestBody).catch((error) => {
      const body: OrderPostError = error.body

      if (body?.errorType) {
        throw new Error(body.errorType)
      }

      throw error
    })
  }

  getOrderLink(uid: UID): string {
    return this.envConfig.apiUrl + `/api/v1/orders/${uid}`
  }
}