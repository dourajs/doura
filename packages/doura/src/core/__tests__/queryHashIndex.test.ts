import { QueryHashIndex } from '../queryHashIndex'
import { QueryHash } from '../queryTypes'

const hash = (value: string) => value as QueryHash

describe('QueryHashIndex', () => {
  it('should get entries by exact hash', () => {
    const index = new QueryHashIndex<number>()
    index.set(hash('h1'), {
      scope: 'users',
      queryName: 'fetchUser',
      data: 1,
    })

    expect(index.get(hash('h1'))).toEqual({
      scope: 'users',
      queryName: 'fetchUser',
      data: 1,
    })
  })

  it('should find hashes by scope prefix', () => {
    const index = new QueryHashIndex<null>()
    index.set(hash('a'), {
      scope: 'users',
      queryName: 'fetchUser',
      data: null,
    })
    index.set(hash('b'), {
      scope: 'users',
      queryName: 'fetchPosts',
      data: null,
    })
    index.set(hash('c'), {
      scope: 'posts',
      queryName: 'fetchPost',
      data: null,
    })

    expect(index.find(['users'])).toEqual([hash('a'), hash('b')])
  })

  it('should find hashes by scope and query prefix', () => {
    const index = new QueryHashIndex<null>()
    index.set(hash('a'), {
      scope: 'users',
      queryName: 'fetchUser',
      data: null,
    })
    index.set(hash('b'), {
      scope: 'users',
      queryName: 'fetchUser',
      data: null,
    })
    index.set(hash('c'), {
      scope: 'users',
      queryName: 'fetchPosts',
      data: null,
    })

    expect(index.find(['users', 'fetchUser'])).toEqual([hash('a'), hash('b')])
  })

  it('should support forEach and delete by prefix key', () => {
    const index = new QueryHashIndex<null>()
    index.set(hash('a'), {
      scope: 'te"st',
      queryName: 'fetch"Users',
      data: null,
    })
    index.set(hash('b'), {
      scope: 'te"st',
      queryName: 'fetch"Users',
      data: null,
    })
    index.set(hash('c'), {
      scope: 'te"st',
      queryName: 'fetchPosts',
      data: null,
    })

    const seen: QueryHash[] = []
    index.forEach(['te"st', 'fetch"Users'], (entryHash) => {
      seen.push(entryHash)
    })
    expect(seen).toEqual([hash('a'), hash('b')])

    expect(index.delete(['te"st', 'fetch"Users'])).toEqual([
      hash('a'),
      hash('b'),
    ])
    expect(index.get(hash('a'))).toBeUndefined()
    expect(index.get(hash('b'))).toBeUndefined()
    expect(index.get(hash('c'))).toEqual({
      scope: 'te"st',
      queryName: 'fetchPosts',
      data: null,
    })
  })

  it('should delete exact hashes directly', () => {
    const index = new QueryHashIndex<null>()
    index.set(hash('a'), {
      scope: 'users',
      queryName: 'fetchUser',
      data: null,
    })

    expect(index.deleteHash(hash('a'))).toBe(true)
    expect(index.get(hash('a'))).toBeUndefined()
  })
})
