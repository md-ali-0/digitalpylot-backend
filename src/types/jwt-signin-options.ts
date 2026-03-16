export interface SignOptions {
  expiresIn?: number | StringValue;
}

export type StringValue =
  | '7d'
  | '1d'
  | '10h'
  | `${number}ms`
  | `${number}s`
  | `${number}m`
  | `${number}h`
  | `${number}d`
  | `${number}w`
  | `${number}y`
  | '0';
