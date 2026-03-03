import type { Request, Response } from 'express';

export const generateVanityAddress = (req: Request, res: Response) => {
  const { prefix } = req.body;

  if (!prefix) {
    return res.status(400).json({ error: 'Prefix is required!' });
  }

  // Placeholder logic for address generation
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const generatedAddress = `${prefix}-${randomSuffix}`;

  return res.json({ generatedAddress });
};