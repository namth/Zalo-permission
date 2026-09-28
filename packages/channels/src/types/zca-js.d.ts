declare module 'zca-js' {
  export interface LoginQRCallbackPayload {
    type: LoginQRCallbackEventType;
    data?: any;
  }

  export enum LoginQRCallbackEventType {
    QRCodeGenerated = 0,
    QRCodeExpired = 1,
    QRCodeScanned = 2,
    QRCodeDeclined = 3,
    GotLoginInfo = 4,
  }

  export enum ThreadType {
    User = 0,
    Group = 1,
  }

  export interface Credentials {
    imei?: string;
    cookie?: any;
    userAgent?: string;
    [key: string]: any;
  }

  export interface API {
    sendMessage: (options: any, threadId: string, type: ThreadType) => Promise<any>;
    getOwnId: () => string;
    listener: {
      on: (event: string, callback: (...args: any[]) => void) => void;
      start: () => Promise<void>;
      stop: () => void;
    };
    [key: string]: any;
  }

  export class Zalo {
    constructor(options?: any);
    loginQR(options: any, callback: (event: LoginQRCallbackPayload) => void): Promise<API>;
    login(credentials: Credentials): Promise<API>;
    [key: string]: any;
  }
}
