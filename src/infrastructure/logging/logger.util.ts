import { Logger } from '@nestjs/common';

export class LoggerUtil {
  static logError(logger: Logger, context: string, error: any, metadata?: any) {
    const errorMessage = error?.message || String(error);
    const errorStack = error?.stack;
    const errorCode = error?.code;
    const statusCode = error?.response?.status;

    logger.error(
      `[${context}] Error: ${errorMessage}`,
      JSON.stringify(
        {
          code: errorCode,
          statusCode,
          ...(metadata && { metadata }),
          stack: errorStack?.split('\n').slice(0, 3).join('\n'),
        },
        null,
        2
      )
    );
  }

  static logInfo(logger: Logger, context: string, message: string, data?: any) {
    logger.log(
      `[${context}] ${message}${data ? ` — ${JSON.stringify(data)}` : ''}`
    );
  }

  static logDebug(logger: Logger, context: string, message: string, data?: any) {
    if (process.env.NODE_ENV === 'development') {
      logger.debug(
        `[${context}] ${message}${data ? ` — ${JSON.stringify(data)}` : ''}`
      );
    }
  }

  static logGeminiRequest(
    logger: Logger,
    service: string,
    params: any,
    model: string
  ) {
    LoggerUtil.logDebug(logger, `Gemini/${service}`, 'Request', {
      model,
      params: JSON.stringify(params).substring(0, 200), // first 200 chars
    });
  }

  static logGeminiResponse(
    logger: Logger,
    service: string,
    responseLength: number
  ) {
    LoggerUtil.logDebug(logger, `Gemini/${service}`, 'Response received', {
      length: responseLength,
    });
  }

  static logGeminiError(
    logger: Logger,
    service: string,
    error: any,
    params?: any
  ) {
    const isNetworkError = !error?.response;
    const errorType = isNetworkError ? 'Network Error' : 'API Error';

    LoggerUtil.logError(logger, `Gemini/${service}/${errorType}`, error, {
      params: params ? JSON.stringify(params).substring(0, 150) : 'none',
      isNetworkError,
      status: error?.response?.status,
      apiError: error?.response?.data?.error?.message,
    });
  }
}
