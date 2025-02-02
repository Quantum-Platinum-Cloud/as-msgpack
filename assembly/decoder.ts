import { DataReader } from "./datareader";
import { Format, formatName } from "./format";
import { Result } from "./result";
import { E_INVALIDLENGTH } from "util/error";

export class Decoder {
  private readonly decoder: SafeDecoder;

  constructor(ua: ArrayBuffer) {
    this.decoder = new SafeDecoder(ua);
  }

  isNextNil(): bool {
    return this.decoder.isNextNil();
  }

  readBool(): bool {
    return this.decoder.readBool().unwrap();
  }

  readInt8(): i8 {
    return this.decoder.readInt8().unwrap();
  }

  readInt16(): i16 {
    return this.decoder.readInt16().unwrap();
  }

  readInt32(): i32 {
    return this.decoder.readInt32().unwrap();
  }

  readInt64(): i64 {
    return this.decoder.readInt64().unwrap();
  }

  readUInt8(): u8 {
    return this.decoder.readUInt8().unwrap();
  }

  readUInt16(): u16 {
    return this.decoder.readUInt16().unwrap();
  }

  readUInt32(): u32 {
    return this.decoder.readUInt32().unwrap();
  }

  readUInt64(): u64 {
    return this.decoder.readUInt64().unwrap();
  }

  readFloat32(): f32 {
    return this.decoder.readFloat32().unwrap();
  }

  readFloat64(): f64 {
    return this.decoder.readFloat64().unwrap();
  }

  readString(): string {
    return this.decoder.readString().unwrap();
  }

  readStringLength(): u32 {
    return this.decoder.readStringLength().unwrap();
  }

  readBinLength(): u32 {
    return this.decoder.readBinLength().unwrap();
  }

  readByteArray(): ArrayBuffer {
    return this.decoder.readByteArray().unwrap();
  }

  readArraySize(): u32 {
    return this.decoder.readArraySize().unwrap();
  }

  readMapSize(): u32 {
    return this.decoder.readMapSize().unwrap();
  }

  readArray<T>(fn: (decoder: Decoder, i?: u32) => T): Array<T> {
    const size = this.readArraySize();
    let a = new Array<T>();
    for (let i: u32 = 0; i < size; i++) {
      const item = fn(this);
      a.push(item);
    }
    return a;
  }

  readNullableArray<T>(fn: (decoder: Decoder, i?: u32) => T): Array<T> | null {
    if (this.isNextNil()) {
      return null;
    }
    return this.readArray(fn);
  }

  readMap<K, V>(keyFn: (decoder: Decoder, i?: u32) => K, valueFn: (decoder: Decoder, i?: u32) => V): Map<K, V> {
    const size = this.readMapSize();
    let m = new Map<K, V>();
    for (let i: u32 = 0; i < size; i++) {
      const key = keyFn(this, i);
      const value = valueFn(this, i);
      m.set(key, value);
    }
    return m;
  }

  readNullableMap<K, V>(keyFn: (decoder: Decoder, i?: u32) => K, valueFn: (decoder: Decoder, i?: u32) => V): Map<K, V> | null {
    if (this.isNextNil()) {
      return null;
    }
    return this.readMap(keyFn, valueFn);
  }

  isFloat32(u: u8): bool { return this.decoder.isFloat32(u); }
  isFloat64(u: u8): bool { return this.decoder.isFloat64(u); }
  isFixedInt(u: u8): bool { return this.decoder.isFixedInt(u); }
  isNegativeFixedInt(u: u8): bool { return this.decoder.isNegativeFixedInt(u); }
  isFixedMap(u: u8): bool { return this.decoder.isFixedMap(u); }
  isFixedArray(u: u8): bool { return this.decoder.isFixedArray(u); }
  isFixedString(u: u8): bool { return this.decoder.isFixedString(u); }
  isNil(u: u8): bool { return this.decoder.isNil(u); }
  getSize(): u32 { return this.decoder.getSize(); }
  skip(): void { this.decoder.skip(); }
}

export class SafeDecoder {
  private reader: DataReader;

  constructor(ua: ArrayBuffer) {
    this.reader = new DataReader(ua, 0, ua.byteLength);
  }

  isNextNil(): bool {
    if (this.reader.peekUint8() == Format.NIL) {
      this.reader.discard(1);
      return true;
    }
    return false;
  }

  readBool(): Result<bool> {
    const value = this.reader.getUint8();
    if (value == Format.TRUE) {
      return Result.ok<bool>(true);
    } else if (value == Format.FALSE) {
      return Result.ok<bool>(false);
    }
    return Result.err<bool>(new Error("bad value for bool: value = 0x" + value.toString(16) + "; type = " + formatName(value)));
  }

  readInt8(): Result<i8> {
    const result = this.readInt64()
    if (result.isErr) {
      return Result.err<i8>(result.unwrapErr());
    }
    const value = result.unwrap();

    if (value <= <i64>i8.MAX_VALUE && value >= <i64>i8.MIN_VALUE) {
      return Result.ok<i8>(<i8>value);
    }
    return Result.err<i8>(new Error(
      "integer overflow: value = " + value.toString() + "; bits = 8"
    ));
  }

  readInt16(): Result<i16> {
    const result = this.readInt64()
    if (result.isErr) {
      return Result.err<i16>(result.unwrapErr());
    }
    const value = result.unwrap();

    if (value <= <i64>i16.MAX_VALUE && value >= <i64>i16.MIN_VALUE) {
      return Result.ok<i16>(<i16>value);
    }
    return Result.err<i16>(new Error(
      "integer overflow: value = " + value.toString() + "; bits = 16"
    ));
  }

  readInt32(): Result<i32> {
    const result = this.readInt64()
    if (result.isErr) {
      return Result.err<i32>(result.unwrapErr());
    }
    const value = result.unwrap();

    if (value <= <i64>i32.MAX_VALUE && value >= <i64>i32.MIN_VALUE) {
      return Result.ok<i32>(<i32>value);
    }
    return Result.err<i32>(new Error(
      "integer overflow: value = " + value.toString() + "; bits = 32"
    ));
  }

  readInt64(): Result<i64> {
    const prefix = this.reader.getUint8();

    if (this.isFixedInt(prefix)) {
      return Result.ok<i64>(<i64>prefix);
    }
    if (this.isNegativeFixedInt(prefix)) {
      return Result.ok<i64>(<i64>(<i8>prefix));
    }
    switch (prefix) {
      case Format.INT8:
        return Result.ok<i64>(<i64>this.reader.getInt8());
      case Format.INT16:
        return Result.ok<i64>(<i64>this.reader.getInt16());
      case Format.INT32:
        return Result.ok<i64>(<i64>this.reader.getInt32());
      case Format.INT64:
        return Result.ok<i64>(this.reader.getInt64());
      case Format.UINT8:
        return Result.ok<i64>(<i64>this.reader.getUint8());
      case Format.UINT16:
        return Result.ok<i64>(<i64>this.reader.getUint16());
      case Format.UINT32:
        return Result.ok<i64>(<i64>this.reader.getUint32());
      case Format.UINT64: {
        const value = this.reader.getUint64();
        if (value <= <u64>i64.MAX_VALUE) {
          return Result.ok<i64>(<i64>value);
        }

        return Result.err<i64>(new Error(
          "integer overflow: value = " + value.toString() + "; type = i64"
        ));
      }
      default:
        return Result.err<i64>(new Error("bad prefix for int: prefix = 0x" + prefix.toString(16) + "; type = " + formatName(prefix)));
    }
  }

  readUInt8(): Result<u8> {
    const result = this.readUInt64()
    if (result.isErr) {
      return Result.err<u8>(result.unwrapErr());
    }
    const value = result.unwrap();

    if (value <= <u64>u8.MAX_VALUE) {
      return Result.ok<u8>(<u8>value);
    }
    return Result.err<u8>(new Error(
      "unsigned integer overflow: value = " + value.toString() + "; bits = 8"
    ));
  }

  readUInt16(): Result<u16> {
    const result = this.readUInt64()
    if (result.isErr) {
      return Result.err<u16>(result.unwrapErr());
    }
    const value = result.unwrap();

    if (value <= <u64>u16.MAX_VALUE) {
      return Result.ok<u16>(<u16>value);
    }
    return Result.err<u16>(new Error(
      "unsigned integer overflow: value = " + value.toString() + "; bits = 16"
    ));
  }

  readUInt32(): Result<u32> {
    const result = this.readUInt64()
    if (result.isErr) {
      return Result.err<u32>(result.unwrapErr());
    }
    const value = result.unwrap();

    if (value <= <u64>u32.MAX_VALUE) {
      return Result.ok<u32>(<u32>value);
    }
    return Result.err<u32>(new Error(
      "unsigned integer overflow: value = " + value.toString() + "; bits = 32"
    ));
  }

  readUInt64(): Result<u64> {
    const prefix = this.reader.getUint8();

    if (this.isFixedInt(prefix)) {
      return Result.ok<u64>(<u64>prefix);
    } else if (this.isNegativeFixedInt(prefix)) {
      return Result.err<u64>(new Error("bad prefix for unsigned int: prefix = 0x" + prefix.toString(16) + "; type = " + formatName(prefix)));
    }

    switch (prefix) {
      case Format.UINT8:
        return Result.ok<u64>(<u64>this.reader.getUint8());
      case Format.UINT16:
        return Result.ok<u64>(<u64>this.reader.getUint16());
      case Format.UINT32:
        return Result.ok<u64>(<u64>this.reader.getUint32());
      case Format.UINT64:
        return Result.ok<u64>(this.reader.getUint64());
      case Format.INT8: {
        const value = this.reader.getInt8();
        if (value >= 0) {
          return Result.ok<u64>(<u64>value);
        }
        return Result.err<u64>(new Error(
          "integer underflow: value = " + value.toString() + "; type = u64"
        ));
      }
      case Format.INT16:
        const value = this.reader.getInt16();
        if (value >= 0) {
          return Result.ok<u64>(<u64>value);
        }
        return Result.err<u64>(new Error(
          "integer underflow: value = " + value.toString() + "; type = u64"
        ));
      case Format.INT32:
        const value = this.reader.getInt32();
        if (value >= 0) {
          return Result.ok<u64>(<u64>value);
        }
        return Result.err<u64>(new Error(
          "integer underflow: value = " + value.toString() + "; type = u64"
        ));
      case Format.INT64:
        const value = this.reader.getInt64();
        if (value >= 0) {
          return Result.ok<u64>(<u64>value);
        }
        return Result.err<u64>(new Error(
          "integer underflow: value = " + value.toString() + "; type = u64"
        ));
      default:
        return Result.err<u64>(new Error("bad prefix for unsigned int: prefix = 0x" + prefix.toString(16) + "; type = " + formatName(prefix)));
    }
  }

  readFloat32(): Result<f32> {
    const prefix = this.reader.getUint8();
    if (this.isFloat32(prefix)) {
      return Result.ok<f32>(<f32>this.reader.getFloat32());
    } else if (this.isFloat64(prefix)) {
      const value = this.reader.getFloat64();
      const diff = <f64>f32.MAX_VALUE - value;

      if (abs(diff) <= <f64>f32.EPSILON) {
        return Result.ok<f32>(f32.MAX_VALUE);
      } else if (diff < 0) {
        return Result.err<f32>(new Error(
          "float overflow: value = " + value.toString() + "; type = f32"
        ));
      } else {
        return Result.ok<f32>(<f32>value);
      }
    } else {
      return Result.err<f32>(new Error("bad prefix for float: prefix = 0x" + prefix.toString(16) + "; type = " + formatName(prefix)));
    }
  }

  readFloat64(): Result<f64> {
    const prefix = this.reader.getUint8();
    if (this.isFloat64(prefix)) {
      return Result.ok<f64>(<f64>this.reader.getFloat64());
    } else if (this.isFloat32(prefix)) {
      return Result.ok<f64>(<f64>this.reader.getFloat32());
    } else {
      return Result.err<f64>(new Error("bad prefix for float: prefix = 0x" + prefix.toString(16) + "; type = " + formatName(prefix)));
    }
  }

  readString(): Result<string> {
    const result = this.readStringLength();
    if (result.isErr) {
      return Result.err<string>(result.unwrapErr());
    }

    const strLen = result.unwrap();
    const stringBytes = this.reader.getBytes(strLen);
    return Result.ok<string>(String.UTF8.decode(stringBytes));
  }

  readStringLength(): Result<u32> {
    const leadByte = this.reader.getUint8();
    if (this.isFixedString(leadByte)) {
      return Result.ok<u32>(leadByte & 0x1f);
    }
    if (this.isFixedArray(leadByte)) {
      return Result.ok<u32>(<u32>(leadByte & Format.FOUR_LEAST_SIG_BITS_IN_BYTE));
    }
    switch (leadByte) {
      case Format.STR8:
        return Result.ok<u32>(<u32>this.reader.getUint8());
      case Format.STR16:
        return Result.ok<u32>(<u32>this.reader.getUint16());
      case Format.STR32:
        return Result.ok<u32>(this.reader.getUint32());
    }
    return Result.err<u32>(new RangeError(E_INVALIDLENGTH + ": prefix = 0x" + leadByte.toString(16) + "; type = " + formatName(leadByte)));
  }

  readBinLength(): Result<u32> {
    if (this.isNextNil()) {
      return Result.ok<u32>(0);
    }
    const leadByte = this.reader.getUint8();
    if (this.isFixedArray(leadByte)) {
      return Result.ok<u32>(<u32>(leadByte & Format.FOUR_LEAST_SIG_BITS_IN_BYTE));
    }
    switch (leadByte) {
      case Format.BIN8:
        return Result.ok<u32>(<u32>this.reader.getUint8());
      case Format.BIN16:
        return Result.ok<u32>(<u32>this.reader.getUint16());
      case Format.BIN32:
        return Result.ok<u32>(this.reader.getUint32());
    }
    return Result.err<u32>(new RangeError(E_INVALIDLENGTH + ": prefix = 0x" + leadByte.toString(16) + "; type = " + formatName(leadByte)));
  }

  readByteArray(): Result<ArrayBuffer> {
    const result = this.readBinLength();
    if (result.isErr) {
      return Result.err<ArrayBuffer>(result.unwrapErr());
    }

    const arrLength = result.unwrap();
    const arrBytes = this.reader.getBytes(arrLength);
    return Result.ok<ArrayBuffer>(arrBytes);
  }

  readArraySize(): Result<u32> {
    const leadByte = this.reader.getUint8();
    if (this.isFixedArray(leadByte)) {
      return Result.ok<u32>(<u32>(leadByte & Format.FOUR_LEAST_SIG_BITS_IN_BYTE));
    } else if (leadByte == Format.ARRAY16) {
      return Result.ok<u32>(<u32>this.reader.getUint16());
    } else if (leadByte == Format.ARRAY32) {
      return Result.ok<u32>(this.reader.getUint32());
    } else if (leadByte == Format.NIL) {
      return Result.ok<u32>(0);
    }
    return Result.err<u32>(new RangeError(E_INVALIDLENGTH + ": prefix = 0x" + leadByte.toString(16) + "; type = " + formatName(leadByte)));
  }

  readMapSize(): Result<u32> {
    const leadByte = this.reader.getUint8();
    if (this.isFixedMap(leadByte)) {
      return Result.ok<u32>(<u32>(leadByte & Format.FOUR_LEAST_SIG_BITS_IN_BYTE));
    } else if (leadByte == Format.MAP16) {
      return Result.ok<u32>(<u32>this.reader.getUint16());
    } else if (leadByte == Format.MAP32) {
      return Result.ok<u32>(this.reader.getUint32());
    }
    return Result.err<u32>(new RangeError(E_INVALIDLENGTH + ": prefix = 0x" + leadByte.toString(16) + "; type = " + formatName(leadByte)));
  }

  isFloat32(u: u8): bool {
    return u == Format.FLOAT32;
  }

  isFloat64(u: u8): bool {
    return u == Format.FLOAT64;
  }

  isFixedInt(u: u8): bool {
    return u >> 7 == 0;
  }

  isNegativeFixedInt(u: u8): bool {
    return (u & 0xe0) == Format.NEGATIVE_FIXINT;
  }

  isFixedMap(u: u8): bool {
    return (u & 0xf0) == Format.FIXMAP;
  }

  isFixedArray(u: u8): bool {
    return (u & 0xf0) == Format.FIXARRAY;
  }

  isFixedString(u: u8): bool {
    return (u & 0xe0) == Format.FIXSTR;
  }

  isNil(u: u8): bool {
    return u == Format.NIL;
  }

  skip(): void {
    // getSize handles discarding 'msgpack header' info
    let numberOfObjectsToDiscard = this.getSize();

    while (numberOfObjectsToDiscard > 0) {
      this.skip(); // discard next object
      numberOfObjectsToDiscard--;
    }
  }

  getSize(): i32 {
    const leadByte = this.reader.getUint8(); // will discard one
    let objectsToDiscard = <i32>0;
    // Handled for fixed values
    if (this.isNegativeFixedInt(leadByte)) {
      // noop, will just discard the leadbyte
    } else if (this.isFixedInt(leadByte)) {
      // noop, will just discard the leadbyte
    } else if (this.isFixedString(leadByte)) {
      let strLength = leadByte & 0x1f;
      this.reader.discard(strLength);
    } else if (this.isFixedArray(leadByte)) {
      // TODO handle overflow
      objectsToDiscard = <i32>(leadByte & Format.FOUR_LEAST_SIG_BITS_IN_BYTE);
    } else if (this.isFixedMap(leadByte)) {
      // TODO handle overflow
      objectsToDiscard =
        2 * <i32>(leadByte & Format.FOUR_LEAST_SIG_BITS_IN_BYTE);
    } else {
      switch (leadByte) {
        case Format.NIL:
          break;
        case Format.TRUE:
          break;
        case Format.FALSE:
          break;
        case Format.BIN8:
          this.reader.discard(<i32>this.reader.getUint8());
          break;
        case Format.BIN16:
          this.reader.discard(<i32>this.reader.getUint16());
          break;
        case Format.BIN32:
          this.reader.discard(<i32>this.reader.getUint32());
          break;
        case Format.FLOAT32:
          this.reader.discard(4);
          break;
        case Format.FLOAT64:
          this.reader.discard(8);
          break;
        case Format.UINT8:
          this.reader.discard(1);
          break;
        case Format.UINT16:
          this.reader.discard(2);
          break;
        case Format.UINT32:
          this.reader.discard(4);
          break;
        case Format.UINT64:
          this.reader.discard(8);
          break;
        case Format.INT8:
          this.reader.discard(1);
          break;
        case Format.INT16:
          this.reader.discard(2);
          break;
        case Format.INT32:
          this.reader.discard(4);
          break;
        case Format.INT64:
          this.reader.discard(8);
          break;
        case Format.FIXEXT1:
          this.reader.discard(2);
          break;
        case Format.FIXEXT2:
          this.reader.discard(3);
          break;
        case Format.FIXEXT4:
          this.reader.discard(5);
          break;
        case Format.FIXEXT8:
          this.reader.discard(9);
          break;
        case Format.FIXEXT16:
          this.reader.discard(17);
          break;
        case Format.STR8:
          this.reader.discard(this.reader.getUint8());
          break;
        case Format.STR16:
          this.reader.discard(this.reader.getUint16());
          break;
        case Format.STR32:
          // TODO overflow, need to modify discard and underlying array buffer
          this.reader.discard(this.reader.getUint32());
          break;
        case Format.ARRAY16:
          //TODO OVERFLOW
          objectsToDiscard = <i32>this.reader.getUint16();
          break;
        case Format.ARRAY32:
          //TODO OVERFLOW
          objectsToDiscard = <i32>this.reader.getUint32();
          break;
        case Format.MAP16:
          //TODO OVERFLOW
          objectsToDiscard = 2 * <i32>this.reader.getUint16();
          break;
        case Format.MAP32:
          //TODO OVERFLOW
          objectsToDiscard = 2 * <i32>this.reader.getUint32();
          break;
        default:
          throw new TypeError(
            "invalid prefix, bad encoding for val: " + leadByte.toString()
          );
      }
    }

    return objectsToDiscard;
  }

  readArray<T>(fn: (decoder: SafeDecoder, i?: u32) => Result<T>): Result<Array<T>> {
    const result = this.readArraySize();
    if (result.isErr) {
      return Result.err<Array<T>>(result.unwrapErr());
    }

    const size = result.unwrap();
    let a = new Array<T>();
    for (let i: u32 = 0; i < size; i++) {
      const itemResult = fn(this, i);
      if (itemResult.isErr) {
        return Result.err<Array<T>>(itemResult.unwrapErr());
      }
      a.push(itemResult.unwrap());
    }
    return Result.ok<Array<T>>(a);
  }

  readNullableArray<T>(fn: (decoder: SafeDecoder, i?: u32) => Result<T>): Result<Array<T> | null> {
    if (this.isNextNil()) {
      return Result.ok<Array<T> | null>(null);
    }

    const result = this.readArray(fn);
    if (result.isOk) {
      return Result.ok<Array<T> | null>(result.unwrap());
    } else {
      return Result.err<Array<T> | null>(result.unwrapErr());
    }
  }

  readMap<K, V>(
    keyFn: (decoder: SafeDecoder, i?: u32) => Result<K>,
    valueFn: (decoder: SafeDecoder, i?: u32) => Result<V>
  ): Result<Map<K, V>> {
    const result = this.readMapSize();
    if (result.isErr) {
      return Result.err<Map<K, V>>(result.unwrapErr());
    }

    const size = result.unwrap();
    let m = new Map<K, V>();
    for (let i: u32 = 0; i < size; i++) {
      const keyResult = keyFn(this, i);
      if (keyResult.isErr) {
        return Result.err<Map<K, V>>(keyResult.unwrapErr());
      }
      const valueResult = valueFn(this, i);
      if (valueResult.isErr) {
        return Result.err<Map<K, V>>(valueResult.unwrapErr());
      }
      m.set(keyResult.unwrap(), valueResult.unwrap());
    }
    return Result.ok<Map<K, V>>(m);
  }

  readNullableMap<K, V>(
    keyFn: (decoder: SafeDecoder, i?: u32) => Result<K>,
    valueFn: (decoder: SafeDecoder, i?: u32) => Result<V>
  ): Result<Map<K, V> | null> {
    if (this.isNextNil()) {
      return Result.ok<Map<K, V> | null>(null);
    }

    const result = this.readMap(keyFn, valueFn);
    if (result.isOk) {
      return Result.ok<Map<K, V> | null>(result.unwrap());
    } else {
      return Result.err<Map<K, V> | null>(result.unwrapErr());
    }
  }
}
