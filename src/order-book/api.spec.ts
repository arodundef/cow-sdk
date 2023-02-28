import fetchMock, { enableFetchMocks } from 'jest-fetch-mock'
import { BUY_ETH_ADDRESS } from '@cowprotocol/contracts'
import { CowError } from '../common/cow-error'
import { SupportedChainId } from '../common/chains'
import { OrderBookApi } from './api'
import { BuyTokenDestination, EcdsaSigningScheme, OrderKind, SellTokenSource, SigningScheme } from './generated'

enableFetchMocks()

const chainId = 100 as SupportedChainId // Gnosis chain

const orderBookApi = new OrderBookApi()

const HTTP_STATUS_OK = 200
const HTTP_STATUS_NOT_FOUND = 404
const HEADERS = { 'Content-Type': 'application/json' }

const SIGNED_ORDER_RESPONSE = {
  signature:
    '0x4d306ce7c770d22005bcfc00223f8d9aaa04e8a20099cc986cb9ccf60c7e876b777ceafb1e03f359ebc6d3dc84245d111a3df584212b5679cb5f9e6717b69b031b',
  signingScheme: EcdsaSigningScheme.EIP712,
}

const PARTIAL_ORDER = {
  sellToken: '0x6810e776880c02933d47db1b9fc05908e5386b96',
  buyToken: '0x6810e776880c02933d47db1b9fc05908e5386b96',
  receiver: '0x6810e776880c02933d47db1b9fc05908e5386b96',
  sellAmount: '1234567890',
  buyAmount: '1234567890',
  validTo: 0,
  appData: '0x0000000000000000000000000000000000000000000000000000000000000000',
  partiallyFillable: true,
  sellTokenBalance: SellTokenSource.ERC20,
  buyTokenBalance: BuyTokenDestination.ERC20,
  from: '0x6810e776880c02933d47db1b9fc05908e5386b96',
  kind: OrderKind.BUY,
  class: 'market',
}

const ORDER_RESPONSE = {
  ...PARTIAL_ORDER,
  feeAmount: '1234567890',
  ...SIGNED_ORDER_RESPONSE,
  creationTime: '2020-12-03T18:35:18.814523Z',
  owner: '0x6810e776880c02933d47db1b9fc05908e5386b96',
  uid: '0x59920c85de0162e9e55df8d396e75f3b6b7c2dfdb535f03e5c807731c31585eaff714b8b0e2700303ec912bd40496c3997ceea2b616d6710',
  availableBalance: '1234567890',
  executedSellAmount: '1234567890',
  executedSellAmountBeforeFees: '1234567890',
  executedBuyAmount: '1234567890',
  executedFeeAmount: '1234567890',
  invalidated: true,
  status: 'presignaturePending',
  fullFeeAmount: '1234567890',
}

const ETH_FLOW_ORDER_RESPONSE = {
  ...ORDER_RESPONSE,
  owner: '0x76aaf674848311c7f21fc691b0b952f016da49f3', // EthFlowContract
  ethflowData: {
    isRefunded: false,
    validTo: Date.now() + 60 * 1000 * 5,
  },
  onchainUser: '0x6810e776880c02933d47db1b9fc05908e5386b96',
}

const ORDER_CANCELLATION_UID =
  '0x59920c85de0162e9e55df8d396e75f3b6b7c2dfdb535f03e5c807731c31585eaff714b8b0e2700303ec912bd40496c3997ceea2b616d6710'

const TRADE_RESPONSE = {
  blockNumber: 0,
  logIndex: 0,
  orderUid: 'string',
  owner: '0x6810e776880c02933d47db1b9fc05908e5386b96',
  sellToken: '0x6810e776880c02933d47db1b9fc05908e5386b96',
  buyToken: '0x6810e776880c02933d47db1b9fc05908e5386b96',
  sellAmount: '1234567890',
  sellAmountBeforeFees: '1234567890',
  buyAmount: '1234567890',
  transactionHash: '0xd51f28edffcaaa76be4a22f6375ad289272c037f3cc072345676e88d92ced8b5',
}

const RAW_FETCH_RESPONSE_PARAMETERS = {
  body: undefined,
  headers: new Headers({
    Accept: 'application/json',
    'Content-Type': 'application/json',
  }),
  method: 'GET',
  signal: expect.anything(),
}

const FETCH_RESPONSE_PARAMETERS = expect.objectContaining(RAW_FETCH_RESPONSE_PARAMETERS)

describe('Cow Api', () => {
  beforeEach(() => {
    fetchMock.resetMocks()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  test('Valid: Get orders link', async () => {
    const orderLink = await orderBookApi.getOrderLink(chainId, ORDER_RESPONSE.uid)
    expect(orderLink).toEqual(`https://api.cow.fi/xdai/api/v1/orders/${ORDER_RESPONSE.uid}`)
  })

  test('Valid: Get an order', async () => {
    // given
    fetchMock.mockResponseOnce(JSON.stringify(ORDER_RESPONSE), {
      status: HTTP_STATUS_OK,
      headers: HEADERS,
    })

    // when
    const order = await orderBookApi.getOrder(chainId, ORDER_RESPONSE.uid)

    // then
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(
      `https://api.cow.fi/xdai/api/v1/orders/${ORDER_RESPONSE.uid}`,
      FETCH_RESPONSE_PARAMETERS
    )
    expect(order?.uid).toEqual(ORDER_RESPONSE.uid)
  })

  test('Invalid: Get an order', async () => {
    // given
    fetchMock.mockResponse(
      JSON.stringify({
        errorType: 'NotFound',
        description: "You've passed an invalid URL",
      }),
      { status: HTTP_STATUS_NOT_FOUND, headers: HEADERS }
    )

    // when
    const promise = orderBookApi.getOrder(chainId, 'notValidOrderId')

    // then
    await expect(promise).rejects.toThrow('Order was not found')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.cow.fi/xdai/api/v1/orders/notValidOrderId',
      FETCH_RESPONSE_PARAMETERS
    )
  })

  test('Valid: Get last 5 orders for a given trader ', async () => {
    const ORDERS_RESPONSE = Array(5).fill(ORDER_RESPONSE)
    fetchMock.mockResponse(JSON.stringify(ORDERS_RESPONSE), { status: HTTP_STATUS_OK, headers: HEADERS })
    const orders = await orderBookApi.getOrders(chainId, {
      owner: '0x00000000005ef87f8ca7014309ece7260bbcdaeb', // Trader
      limit: 5,
      offset: 0,
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.cow.fi/xdai/api/v1/account/0x00000000005ef87f8ca7014309ece7260bbcdaeb/orders?offset=0&limit=5',
      FETCH_RESPONSE_PARAMETERS
    )
    expect(orders.length).toEqual(5)
  })

  test('Invalid: Get last 5 orders for an unexisting trader ', async () => {
    // given
    fetchMock.mockResponse(
      JSON.stringify({
        errorType: 'NotFound',
        description: "You've passed an invalid URL",
      }),
      { status: HTTP_STATUS_NOT_FOUND, headers: HEADERS }
    )

    // when
    const promise = orderBookApi.getOrders(chainId, {
      owner: 'invalidOwner',
      limit: 5,
      offset: 0,
    })

    // then
    await expect(promise).rejects.toThrow('Not Found')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.cow.fi/xdai/api/v1/account/invalidOwner/orders?offset=0&limit=5',
      FETCH_RESPONSE_PARAMETERS
    )
  })

  test('Valid: Get tx orders from a given txHash', async () => {
    const ORDERS_RESPONSE = Array(5).fill(ORDER_RESPONSE)
    const txHash = '0xd51f28edffcaaa76be4a22f6375ad289272c037f3cc072345676e88d92ced8b5'
    fetchMock.mockResponse(JSON.stringify(ORDERS_RESPONSE), { status: HTTP_STATUS_OK, headers: HEADERS })
    const txOrders = await orderBookApi.getTxOrders(chainId, txHash)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(
      `https://api.cow.fi/xdai/api/v1/transactions/${txHash}/orders`,
      FETCH_RESPONSE_PARAMETERS
    )
    expect(txOrders.length).toEqual(5)
  })

  test('Invalid: Get tx orders from an unexisting txHash', async () => {
    // given
    fetchMock.mockResponse(
      JSON.stringify({
        errorType: 'NotFound',
        description: "You've passed an invalid URL",
      }),
      { status: HTTP_STATUS_NOT_FOUND, headers: HEADERS }
    )

    // when
    const promise = orderBookApi.getTxOrders(chainId, 'invalidTxHash')

    // then
    await expect(promise).rejects.toThrow('Not Found')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.cow.fi/xdai/api/v1/transactions/invalidTxHash/orders',
      FETCH_RESPONSE_PARAMETERS
    )
  })

  test('Valid: Get last 5 trades for a given trader ', async () => {
    const TRADES_RESPONSE = Array(5).fill(TRADE_RESPONSE)
    fetchMock.mockResponse(JSON.stringify(TRADES_RESPONSE), { status: HTTP_STATUS_OK, headers: HEADERS })
    const trades = await orderBookApi.getTrades(chainId, {
      owner: TRADE_RESPONSE.owner, // Trader
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(
      `https://api.cow.fi/xdai/api/v1/trades?owner=${TRADE_RESPONSE.owner}`,
      FETCH_RESPONSE_PARAMETERS
    )
    expect(trades.length).toEqual(5)
  })

  test('Valid: Get last 5 trades for a given order id ', async () => {
    const TRADES_RESPONSE = Array(5).fill(TRADE_RESPONSE)
    fetchMock.mockResponse(JSON.stringify(TRADES_RESPONSE), { status: HTTP_STATUS_OK, headers: HEADERS })
    const trades = await orderBookApi.getTrades(chainId, {
      orderId: TRADE_RESPONSE.orderUid,
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(
      `https://api.cow.fi/xdai/api/v1/trades?orderUid=${TRADE_RESPONSE.orderUid}`,
      FETCH_RESPONSE_PARAMETERS
    )
    expect(trades.length).toEqual(5)
  })

  test('Invalid: Get trades passing both the owner and orderId', async () => {
    expect(
      orderBookApi.getTrades(chainId, {
        owner: TRADE_RESPONSE.owner,
        orderId: TRADE_RESPONSE.orderUid,
      })
    ).rejects.toThrowError(CowError)
  })

  test('Invalid: Get last 5 trades for an unexisting trader ', async () => {
    // given
    fetchMock.mockResponse(
      JSON.stringify({
        errorType: 'NotFound',
        description: "You've passed an invalid URL",
      }),
      { status: HTTP_STATUS_NOT_FOUND, headers: HEADERS }
    )

    // when
    const promise = orderBookApi.getTrades(chainId, {
      owner: 'invalidOwner',
    })

    // then
    await expect(promise).rejects.toThrow('Not Found')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.cow.fi/xdai/api/v1/trades?owner=invalidOwner',
      FETCH_RESPONSE_PARAMETERS
    )
  })

  // TODO: move to another class - walletSDK or something similar
  // test('Valid: Sign Order', async () => {
  //   const order: Omit<UnsignedOrder, 'appData'> = {
  //     kind: OrderKind.SELL,
  //     partiallyFillable: false, // Allow partial executions of an order (true would be for a "Fill or Kill" order, which is not yet supported but will be added soon)
  //     sellToken: '0xc778417e063141139fce010982780140aa0cd5ab', // WETH
  //     buyToken: '0x4dbcdf9b62e891a7cec5a2568c3f4faf9e8abe2b', // USDC
  //     sellAmount: '1234567890',
  //     buyAmount: '1234567890',
  //     validTo: 2524608000,
  //     receiver: '0x6810e776880c02933d47db1b9fc05908e5386b96',
  //     feeAmount: '1234567890',
  //   }
  //
  //   const signedOrder = await cowSdk.signOrder(order)
  //   expect(signedOrder.signature).not.toBeNull()
  //   expect(signedOrder.signingScheme).not.toBeNull()
  // })

  test('Valid: Send sign order cancellation', async () => {
    fetchMock.mockResponseOnce(JSON.stringify(SIGNED_ORDER_RESPONSE), { status: HTTP_STATUS_OK, headers: HEADERS })
    await orderBookApi.sendSignedOrderCancellation(chainId, ORDER_CANCELLATION_UID, SIGNED_ORDER_RESPONSE)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(
      `https://api.cow.fi/xdai/api/v1/orders/${ORDER_CANCELLATION_UID}`,
      expect.objectContaining({
        ...RAW_FETCH_RESPONSE_PARAMETERS,
        body: JSON.stringify(SIGNED_ORDER_RESPONSE),
        method: 'DELETE',
      })
    )
  })

  test('Invalid: Send sign not found order cancellation', async () => {
    // given
    fetchMock.mockResponse(
      JSON.stringify({
        errorType: 'NotFound',
        description: "You've passed an invalid URL",
      }),
      { status: HTTP_STATUS_NOT_FOUND, headers: HEADERS }
    )

    // when
    const promise = orderBookApi.sendSignedOrderCancellation(chainId, 'unexistingOrder', SIGNED_ORDER_RESPONSE)

    // then
    await expect(promise).rejects.toThrow('Order was not found')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.cow.fi/xdai/api/v1/orders/unexistingOrder',
      expect.objectContaining({
        ...RAW_FETCH_RESPONSE_PARAMETERS,
        body: JSON.stringify(SIGNED_ORDER_RESPONSE),
        method: 'DELETE',
      })
    )
  })

  // TODO move to another class - walletSDK or something similar
  // test('Valid: Sign cancellation Order', async () => {
  //   const signCancellationOrder = await cowSdk.signOrderCancellation(ORDER_RESPONSE.uid)
  //   expect(signCancellationOrder.signature).not.toBeNull()
  //   expect(signCancellationOrder.signingScheme).not.toBeNull()
  // })

  test('Valid: Send an order ', async () => {
    fetchMock.mockResponseOnce(JSON.stringify('validOrderId'), { status: HTTP_STATUS_OK, headers: HEADERS })
    const orderId = await orderBookApi.sendOrder(chainId, {
      ...ORDER_RESPONSE,
      ...SIGNED_ORDER_RESPONSE,
      signingScheme: SigningScheme.EIP712,
      from: '0x1811be0994930fe9480eaede25165608b093ad7a',
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.cow.fi/xdai/api/v1/orders',
      expect.objectContaining({
        ...RAW_FETCH_RESPONSE_PARAMETERS,
        body: JSON.stringify({
          ...ORDER_RESPONSE,
          ...SIGNED_ORDER_RESPONSE,
          from: '0x1811be0994930fe9480eaede25165608b093ad7a',
          signingScheme: 'eip712',
        }),
        method: 'POST',
      })
    )
    expect(orderId).toEqual('validOrderId')
  })

  test('Invalid: Send an duplicate order ', async () => {
    // given
    fetchMock.mockResponse(
      JSON.stringify({
        errorType: 'DuplicateOrder',
        description: 'order already exists',
      }),
      { status: 400, headers: HEADERS }
    )

    // when
    const promise = orderBookApi.sendOrder(chainId, {
      ...ORDER_RESPONSE,
      ...SIGNED_ORDER_RESPONSE,
      signingScheme: SigningScheme.EIP712,
      from: '0x1811be0994930fe9480eaede25165608b093ad7a',
    })

    // then
    await expect(promise).rejects.toThrow('DuplicateOrder')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.cow.fi/xdai/api/v1/orders',
      expect.objectContaining({
        ...RAW_FETCH_RESPONSE_PARAMETERS,
        body: JSON.stringify({
          ...ORDER_RESPONSE,
          ...SIGNED_ORDER_RESPONSE,
          from: '0x1811be0994930fe9480eaede25165608b093ad7a',
          signingScheme: 'eip712',
        }),
        method: 'POST',
      })
    )
  })

  test('Valid: Get last 5 orders changing options parameters', async () => {
    const ORDERS_RESPONSE = Array(5).fill(ORDER_RESPONSE)
    fetchMock.mockResponseOnce(JSON.stringify(ORDERS_RESPONSE), { status: HTTP_STATUS_OK, headers: HEADERS })
    const orders = await orderBookApi.getOrders(chainId, {
      owner: '0x00000000005ef87f8ca7014309ece7260bbcdaeb', // Trader
      limit: 5,
      offset: 0,
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.cow.fi/xdai/api/v1/account/0x00000000005ef87f8ca7014309ece7260bbcdaeb/orders?offset=0&limit=5',
      FETCH_RESPONSE_PARAMETERS
    )
    expect(orders.length).toEqual(5)
  })

  test('Valid: Get last 5 trades changing options parameters', async () => {
    const TRADES_RESPONSE = Array(5).fill(TRADE_RESPONSE)
    fetchMock.mockResponseOnce(JSON.stringify(TRADES_RESPONSE), { status: HTTP_STATUS_OK, headers: HEADERS })
    const trades = await orderBookApi.getTrades(chainId, {
      owner: TRADE_RESPONSE.owner, // Trader
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(
      `https://api.cow.fi/xdai/api/v1/trades?owner=${TRADE_RESPONSE.owner}`,
      FETCH_RESPONSE_PARAMETERS
    )
    expect(trades.length).toEqual(5)
  })

  describe('Transform EthFlow orders', () => {
    test('getOrder', async () => {
      fetchMock.mockResponseOnce(JSON.stringify(ETH_FLOW_ORDER_RESPONSE), {
        status: HTTP_STATUS_OK,
        headers: HEADERS,
      })

      // when
      const order = await orderBookApi.getOrder(chainId, ETH_FLOW_ORDER_RESPONSE.uid)

      // then
      expect(order?.owner).toEqual(order?.onchainUser)
      expect(order?.validTo).toEqual(order?.ethflowData?.userValidTo)
      expect(order?.sellToken).toEqual(BUY_ETH_ADDRESS)
    })

    test('getOrders', async () => {
      // given
      const ORDERS_RESPONSE = [ETH_FLOW_ORDER_RESPONSE, ORDER_RESPONSE]
      fetchMock.mockResponse(JSON.stringify(ORDERS_RESPONSE), { status: HTTP_STATUS_OK, headers: HEADERS })

      // when
      const orders = await orderBookApi.getOrders(chainId, {
        owner: '0x6810e776880c02933d47db1b9fc05908e5386b96', // Trader
        limit: 5,
        offset: 0,
      })

      // then
      // eth flow order
      expect(orders[0].owner).toEqual(orders[0].onchainUser)
      expect(orders[0].validTo).toEqual(orders[0].ethflowData?.userValidTo)
      expect(orders[0].sellToken).toEqual(BUY_ETH_ADDRESS)
      // regular order
      expect(orders[1].owner).toEqual(ORDER_RESPONSE.owner)
      expect(orders[1].validTo).toEqual(ORDER_RESPONSE.validTo)
      expect(orders[1].sellToken).toEqual(ORDER_RESPONSE.sellToken)
    })

    test('getTxOrders', async () => {
      // given
      const ORDERS_RESPONSE = [ETH_FLOW_ORDER_RESPONSE, ORDER_RESPONSE]
      const txHash = '0xd51f28edffcaaa76be4a22f6375ad289272c037f3cc072345676e88d92ced8b5'
      fetchMock.mockResponse(JSON.stringify(ORDERS_RESPONSE), { status: HTTP_STATUS_OK, headers: HEADERS })

      // when
      const txOrders = await orderBookApi.getTxOrders(chainId, txHash)

      // then
      // eth flow order
      expect(txOrders[0].owner).toEqual(txOrders[0].onchainUser)
      expect(txOrders[0].validTo).toEqual(txOrders[0].ethflowData?.userValidTo)
      expect(txOrders[0].sellToken).toEqual(BUY_ETH_ADDRESS)
      // regular order
      expect(txOrders[1].owner).toEqual(ORDER_RESPONSE.owner)
      expect(txOrders[1].validTo).toEqual(ORDER_RESPONSE.validTo)
      expect(txOrders[1].sellToken).toEqual(ORDER_RESPONSE.sellToken)
    })
  })

  test('API getOrder() method should return order with "class" property', async () => {
    // given
    fetchMock.mockResponseOnce(JSON.stringify({ ...ORDER_RESPONSE, class: 'limit' }), {
      status: HTTP_STATUS_OK,
      headers: HEADERS,
    })

    // when
    const order = await orderBookApi.getOrder(chainId, ORDER_RESPONSE.uid)

    // then
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(
      `https://api.cow.fi/xdai/api/v1/orders/${ORDER_RESPONSE.uid}`,
      FETCH_RESPONSE_PARAMETERS
    )
    expect(order?.class).toEqual('limit')
  })
})