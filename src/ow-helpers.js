import validate from 'aproba'
import ow from 'ow'

export function checkIndex(idx, array) {
  validate('NA', arguments)
  ow(array, ow.array.nonEmpty)
  ow(idx, ow.number.greaterThanOrEqual(0))
  ow(idx, ow.number.lessThan(array.length))
}
