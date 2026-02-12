/**
 * Embedding Service
 * Generates vector embeddings using OpenAI API
 */

import OpenAI from 'openai';
import { logger } from './logger';

class EmbeddingClient {
  private client: OpenAI | null;
  private model = 'text-embedding-3-large';
  private dimensions = 1536; // OpenAI text-embedding-3-large produces 1536-dimensional vectors

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      logger.warn('OPENAI_API_KEY not set in environment variables');
      this.client = null;
    } else {
      this.client = new OpenAI({
        apiKey,
      });
    }
  }

  /**
    * Generate embedding for a given text
    */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      if (!text || text.trim().length === 0) {
        logger.warn('Empty text provided for embedding');
        // Return zero vector for empty text
        return new Array(this.dimensions).fill(0);
      }

      if (!this.client) {
        logger.warn('OpenAI client not initialized - returning zero vector');
        return new Array(this.dimensions).fill(0);
      }

      const response = await this.client.embeddings.create({
        model: this.model,
        input: text,
        dimensions: this.dimensions,
      });

      if (!response.data || response.data.length === 0) {
        throw new Error('No embedding data returned from OpenAI API');
      }

      // Extract embedding array from response
      const embedding = response.data[0].embedding;

      if (!Array.isArray(embedding)) {
        throw new Error('Invalid embedding format returned from OpenAI API');
      }

      logger.debug(`Generated embedding for text: ${text.substring(0, 50)}...`);
      return embedding;
    } catch (error) {
      logger.error(`Failed to generate embedding: ${error}`);
      throw error;
    }
  }

  /**
    * Generate embeddings for multiple texts in batch
    */
  async generateEmbeddingsBatch(texts: string[]): Promise<number[][]> {
    try {
      if (!texts || texts.length === 0) {
        logger.warn('Empty texts array provided for batch embedding');
        return [];
      }

      if (!this.client) {
        logger.warn('OpenAI client not initialized - returning zero vectors');
        return texts.map(() => new Array(this.dimensions).fill(0));
      }

      const response = await this.client.embeddings.create({
        model: this.model,
        input: texts,
        dimensions: this.dimensions,
      });

      if (!response.data || response.data.length === 0) {
        throw new Error('No embedding data returned from OpenAI API');
      }

      // Sort by index to ensure correct order
      const embeddings = response.data
        .sort((a, b) => a.index - b.index)
        .map((item) => {
          if (!Array.isArray(item.embedding)) {
            throw new Error('Invalid embedding format returned from OpenAI API');
          }
          return item.embedding;
        });

      logger.debug(`Generated ${embeddings.length} embeddings in batch`);
      return embeddings;
    } catch (error) {
      logger.error(`Failed to generate batch embeddings: ${error}`);
      throw error;
    }
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  static cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Embeddings must have the same length');
    }

    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);

    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));

    if (magnitudeA === 0 || magnitudeB === 0) {
      return 0;
    }

    return dotProduct / (magnitudeA * magnitudeB);
  }

  /**
   * Get model info
   */
  getModelInfo() {
    return {
      model: this.model,
      dimensions: this.dimensions,
    };
  }
}

// Export singleton instance
export const embeddingClient = new EmbeddingClient();
