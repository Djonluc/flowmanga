/**
 * Minimal Protobuf Wire-Format Decoder
 * 
 * Decodes raw protobuf binary into navigable field maps without
 * requiring schema compilation or npm dependencies.
 * 
 * Based on: https://protobuf.dev/programming-guides/encoding/
 */

export interface ProtoField {
  wireType: number;
  intValue?: number;
  bytesValue?: Uint8Array;
}

/** Map of field_number → array of field values (supports repeated fields) */
export type FieldMap = Map<number, ProtoField[]>;

// ─── Low-Level Decoders ─────────────────────────────────────────────

function readVarint(buf: Uint8Array, offset: number): [number, number] {
  let result = 0;
  let shift = 0;
  let pos = offset;

  while (pos < buf.length) {
    const byte = buf[pos];
    result |= (byte & 0x7f) << shift;
    pos++;
    if ((byte & 0x80) === 0) break;
    shift += 7;
    if (shift >= 35) {
      // Skip remaining bytes of oversized varint (64-bit)
      while (pos < buf.length && (buf[pos] & 0x80) !== 0) pos++;
      if (pos < buf.length) pos++;
      break;
    }
  }

  return [result >>> 0, pos];
}

// ─── Message Decoder ────────────────────────────────────────────────

/**
 * Decode a protobuf binary message into a FieldMap.
 * Does NOT require schema knowledge — uses wire format only.
 */
export function decodeMessage(data: Uint8Array): FieldMap {
  const fields: FieldMap = new Map();
  let offset = 0;

  while (offset < data.length) {
    const [tag, tagEnd] = readVarint(data, offset);
    offset = tagEnd;

    const fieldNumber = tag >>> 3;
    const wireType = tag & 0x07;

    if (fieldNumber === 0 || offset > data.length) break;

    const field: ProtoField = { wireType };

    switch (wireType) {
      case 0: {
        // Varint
        const [value, next] = readVarint(data, offset);
        field.intValue = value;
        offset = next;
        break;
      }
      case 1: {
        // 64-bit fixed — skip
        offset += 8;
        break;
      }
      case 2: {
        // Length-delimited (string, bytes, sub-message)
        const [length, next] = readVarint(data, offset);
        offset = next;
        if (offset + length > data.length) return fields; // truncated
        field.bytesValue = data.slice(offset, offset + length);
        offset += length;
        break;
      }
      case 5: {
        // 32-bit fixed — skip
        offset += 4;
        break;
      }
      default:
        // Unknown wire type — stop parsing
        return fields;
    }

    if (!fields.has(fieldNumber)) {
      fields.set(fieldNumber, []);
    }
    fields.get(fieldNumber)!.push(field);
  }

  return fields;
}

// ─── Field Accessors ────────────────────────────────────────────────

/** Get first sub-message from a length-delimited field */
export function getMessage(fields: FieldMap, num: number): FieldMap | undefined {
  const entries = fields.get(num);
  if (!entries?.[0]?.bytesValue) return undefined;
  return decodeMessage(entries[0].bytesValue);
}

/** Get all instances of a repeated sub-message field */
export function getRepeatedMessages(fields: FieldMap, num: number): FieldMap[] {
  const entries = fields.get(num);
  if (!entries) return [];
  return entries
    .filter((e) => e.bytesValue)
    .map((e) => decodeMessage(e.bytesValue!));
}

/** Decode a length-delimited field as a UTF-8 string */
export function getString(fields: FieldMap, num: number): string {
  const entries = fields.get(num);
  if (!entries?.[0]?.bytesValue) return "";
  return new TextDecoder().decode(entries[0].bytesValue);
}

/** Get an integer (varint) field value */
export function getInt(fields: FieldMap, num: number): number {
  const entries = fields.get(num);
  if (!entries?.[0]) return 0;
  return entries[0].intValue ?? 0;
}

/** Get raw bytes from a length-delimited field */
export function getBytes(
  fields: FieldMap,
  num: number,
): Uint8Array | undefined {
  const entries = fields.get(num);
  return entries?.[0]?.bytesValue;
}

/** Get all string values from a repeated string field */
export function getRepeatedStrings(fields: FieldMap, num: number): string[] {
  const entries = fields.get(num);
  if (!entries) return [];
  return entries
    .filter((e) => e.bytesValue)
    .map((e) => new TextDecoder().decode(e.bytesValue!));
}
