import { TypedMap, BigInt, BigDecimal, ethereum, log, Address } from "@graphprotocol/graph-ts"

import { Factory, OraclePrice, PriceMinData, Price15MinData, PriceHourData, PriceDayData, PriceSevenDayData } from '../generated/schema'
import { Oracle as OracleContract } from '../generated/Factory/Oracle'

import { CreateLiquidityPool } from '../generated/Factory/Factory'
import { CreatePerpetual } from '../generated/templates/LiquidityPool/LiquidityPool'

import { 
    LiquidityPool as LiquidityPoolTemplate,
} from '../generated/templates'

import { HANDLER_BLOCK } from './const'

export const FACTORY = "mcdex"
let ZERO_BI = BigInt.fromI32(0)
let ONE_BI = BigInt.fromI32(1)
let ZERO_BD = BigDecimal.fromString('0')
let BI_18 = BigInt.fromI32(18)


export function exponentToBigDecimal(decimals: BigInt): BigDecimal {
    let bd = BigDecimal.fromString('1')
    for (let i = ZERO_BI; i.lt(decimals as BigInt); i = i.plus(ONE_BI)) {
        bd = bd.times(BigDecimal.fromString('10'))
    }
    return bd
}
  
export function convertToDecimal(amount: BigInt, decimals: BigInt): BigDecimal {
    if (decimals == ZERO_BI) {
        return amount.toBigDecimal()
    }
    return amount.toBigDecimal().div(exponentToBigDecimal(decimals))
}

export function handleCreateLiquidityPool(event: CreateLiquidityPool): void {
    let factory = Factory.load(FACTORY)
    if (factory === null) {
        factory = new Factory(FACTORY)
        factory.oracles = []
        factory.hourTimestamp = event.block.timestamp.toI32()  / 3600 * 3600
        factory.save()
    }

    // create the tracked contract based on the template
    LiquidityPoolTemplate.create(event.params.liquidityPool)
}

export function isOracleAdded(oracles: string[], oracle: string): boolean {
    for (let i = 0; i < oracles.length; i++) {
      if (oracle == oracles[i]) {
        return true
      }
    }
    return false
  }

export function handleCreatePerpetual(event: CreatePerpetual): void {
    let factory = Factory.load(FACTORY)
    if (factory === null) {
        return
    }
    let oracleAddress = event.params.oracle.toHexString()
    let oracles = factory.oracles
    if (!isOracleAdded(oracles as string[], oracleAddress)) {
        oracles.push(oracleAddress)
        factory.oracles = oracles
        factory.save()
    }
}

export function handleOraclePrice(block: ethereum.Block): void {
    let factory = Factory.load(FACTORY)
    if (factory === null) {
        return
    }
    let timestamp = block.timestamp.toI32()

    let hourIndex = timestamp / 3600
    let hourStartUnix = hourIndex * 3600
    if (block.number < BigInt.fromI32(HANDLER_BLOCK)) {
        if (factory.hourTimestamp == hourStartUnix) {
            return
        }
    }

    factory.hourTimestamp = hourStartUnix
    factory.save()
    // update perpetual's oracle price data
    let oracles = factory.oracles as string[]
    for (let index = 0; index < oracles.length; index++) {
        let oracle = oracles[index]
        updatePriceData(oracle, timestamp)
    }
}

function updatePriceData(oracle: String, timestamp: i32): void {
    let price = ZERO_BD
    // 1Min
    let minIndex = timestamp / 60
    let minStartUnix = minIndex * 60
    let minPriceID = oracle
    .concat('-')
    .concat(BigInt.fromI32(minIndex).toString())
    let priceMinData = PriceMinData.load(minPriceID)
    if (priceMinData === null) {
        let contract = OracleContract.bind(Address.fromString(oracle))
        let callResult = contract.try_priceTWAPShort()
        if (!callResult.reverted) {
            price = convertToDecimal(callResult.value.value0, BI_18)
        }
    
        if (price == ZERO_BD) {
            return
        }
    
        // save oracle index price
        let oraclePrice = OraclePrice.load(oracle)
        if (oraclePrice === null) {
            oraclePrice = new OraclePrice(oracle)
        }
        oraclePrice.price = price
        oraclePrice.save()

        priceMinData = new PriceMinData(minPriceID)
        priceMinData.oracle = oracle
        priceMinData.open = price
        priceMinData.close = price
        priceMinData.high = price
        priceMinData.low = price
        priceMinData.timestamp = minStartUnix
        priceMinData.save()
    } else {
        return
    }

    // 15Min
    let fifminIndex = timestamp / (60*15)
    let fifminStartUnix = fifminIndex * (60*15)
    let fifminPriceID = oracle
    .concat('-')
    .concat(BigInt.fromI32(fifminIndex).toString())
    let price15MinData = Price15MinData.load(fifminPriceID)
    if (price15MinData === null) {

        price15MinData = new Price15MinData(fifminPriceID)
        price15MinData.oracle = oracle
        price15MinData.open = price
        price15MinData.close = price
        price15MinData.high = price
        price15MinData.low = price
        price15MinData.timestamp = fifminStartUnix
    } else {
        price15MinData.close = price
        if (price15MinData.high < price) {
            price15MinData.high = price
        } else if(price15MinData.low > price) {
            price15MinData.low = price
        }
    }
    price15MinData.save()

    // hour
    let hourIndex = timestamp / 3600
    let hourStartUnix = hourIndex * 3600
    let hourPriceID = oracle
    .concat('-')
    .concat(BigInt.fromI32(hourIndex).toString())
    let priceHourData = PriceHourData.load(hourPriceID)
    if (priceHourData === null) {
        priceHourData = new PriceHourData(hourPriceID)
        priceHourData.oracle = oracle
        priceHourData.open = price
        priceHourData.close = price
        priceHourData.high = price
        priceHourData.low = price
        priceHourData.timestamp = hourStartUnix
    } else {
        priceHourData.close = price
        if (priceHourData.high < price) {
            priceHourData.high = price
        } else if(priceHourData.low > price) {
            priceHourData.low = price
        }
    }
    priceHourData.save()

    // day
    let dayIndex = timestamp / (3600*24)
    let dayStartUnix = dayIndex * (3600*24)
    let dayPriceID = oracle
    .concat('-')
    .concat(BigInt.fromI32(dayIndex).toString())
    let priceDayData = PriceDayData.load(dayPriceID)
    if (priceDayData === null) {
        priceDayData = new PriceDayData(dayPriceID)
        priceDayData.oracle = oracle
        priceDayData.open = price
        priceDayData.close = price
        priceDayData.high = price
        priceDayData.low = price
        priceDayData.timestamp = dayStartUnix
    } else {
        priceDayData.close = price
        if (priceDayData.high < price) {
            priceDayData.high = price
        } else if(priceDayData.low > price) {
            priceDayData.low = price
        }
    }
    priceDayData.save()

    // seven day
    let sevenDayIndex = timestamp / (3600*24*7)
    let sevenDayStartUnix = sevenDayIndex * (3600*24*7)
    let sevenDayPriceID = oracle
    .concat('-')
    .concat(BigInt.fromI32(sevenDayIndex).toString())
    let priceSevenDayData = PriceSevenDayData.load(sevenDayPriceID)
    if (priceSevenDayData === null) {
        priceSevenDayData = new PriceSevenDayData(sevenDayPriceID)
        priceSevenDayData.oracle = oracle
        priceSevenDayData.open = price
        priceSevenDayData.close = price
        priceSevenDayData.high = price
        priceSevenDayData.low = price
        priceSevenDayData.timestamp = sevenDayStartUnix
    } else {
        priceSevenDayData.close = price
        if (priceSevenDayData.high < price) {
            priceSevenDayData.high = price
        } else if(priceSevenDayData.low > price) {
            priceSevenDayData.low = price
        }
    }
    priceSevenDayData.save()
}
