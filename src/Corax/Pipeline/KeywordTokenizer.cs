﻿using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Corax.Pipeline
{
    public struct KeywordTokenizer : ITokenizer
    {     
        public bool SupportUtf8 => true;

        public int Tokenize(ReadOnlySpan<byte> source, ref Span<Token> tokens)
        {
            ref var token = ref tokens[0];
            token.Offset = 0;
            token.Length = (uint)source.Length;
            token.Type = TokenType.Term;

            tokens = tokens.Slice(0, 1);
            return source.Length;
        }

        public int Tokenize(ReadOnlySpan<char> source, ref Span<Token> tokens)
        {
            ref var token = ref tokens[0];
            token.Offset = 0;
            token.Length = (uint)source.Length;
            token.Type = TokenType.Term;

            tokens = tokens.Slice(0, 1);
            return source.Length;
        }

        public void Dispose() { }
    }
}
