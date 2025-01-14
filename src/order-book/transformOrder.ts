import { Order } from './generated'
import { EnrichedOrder } from './types'

export const BUY_ETH_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'

export function transformOrder(order: Order): EnrichedOrder {
  return transformEthFlowOrder(addTotalFeeToOrder(order))
}

/**
 * The executedSurplusFee represents exactly the fee that was charged (regardless of the fee signed with the order).
 * So, while the protocol currently does not allow placing a limit order with any other fee than 0 - the backend is designed to support these kinds of orders for the future.
 */
function addTotalFeeToOrder(dto: Order): EnrichedOrder {
  const { executedFeeAmount, executedSurplusFee } = dto
  const totalFee = executedSurplusFee ?? executedFeeAmount

  return {
    ...dto,
    totalFee,
  }
}

/**
 * Transform order field for Native EthFlow orders
 *
 * A no-op for regular orders
 * For Native EthFlow, due to how the contract is setup:
 * - sellToken set to Native token address
 * - owner set to `onchainUser`
 * - validTo set to `ethflowData.userValidTo`
 */
function transformEthFlowOrder(order: EnrichedOrder): EnrichedOrder {
  const { ethflowData } = order

  if (!ethflowData) {
    return order
  }

  const { userValidTo: validTo } = ethflowData
  const owner = order.onchainUser || order.owner
  const sellToken = BUY_ETH_ADDRESS

  return { ...order, validTo, owner, sellToken }
}
