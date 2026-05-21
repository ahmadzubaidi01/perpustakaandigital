import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import apiResponse from '../utils/apiResponse';

/**
 * Validation middleware factory.
 * Validates request body, params, and query against Joi schemas.
 */
const validate = (schema: {
  body?: Joi.ObjectSchema;
  params?: Joi.ObjectSchema;
  query?: Joi.ObjectSchema;
}) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const errors: { field: string; message: string }[] = [];

    if (schema.body) {
      const { error, value } = schema.body.validate(req.body, { abortEarly: false, stripUnknown: true });
      if (error) {
        errors.push(
          ...error.details.map((d) => ({
            field: d.path.join('.'),
            message: d.message.replace(/"/g, ''),
          }))
        );
      } else {
        req.body = value;
      }
    }

    if (schema.params) {
      const { error, value } = schema.params.validate(req.params, { abortEarly: false });
      if (error) {
        errors.push(
          ...error.details.map((d) => ({
            field: `params.${d.path.join('.')}`,
            message: d.message.replace(/"/g, ''),
          }))
        );
      } else {
        req.params = value;
      }
    }

    if (schema.query) {
      const { error, value } = schema.query.validate(req.query, { abortEarly: false, stripUnknown: true });
      if (error) {
        errors.push(
          ...error.details.map((d) => ({
            field: `query.${d.path.join('.')}`,
            message: d.message.replace(/"/g, ''),
          }))
        );
      } else {
        req.query = value;
      }
    }

    if (errors.length > 0) {
      apiResponse.unprocessable(res, 'Validation failed', errors);
      return;
    }

    next();
  };
};

export { validate };
