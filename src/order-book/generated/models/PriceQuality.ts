/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

/**
 * How good should the price estimate be?
 * Note that orders are supposed to be created from "optimal" price estimates.
 *
 */
export enum PriceQuality {
    FAST = 'fast',
    OPTIMAL = 'optimal',
}
