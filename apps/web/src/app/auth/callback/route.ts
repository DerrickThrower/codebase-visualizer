import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const connected = searchParams.get('connected');
  const error = searchParams.get('error');

  if (error) {
    return NextResponse.redirect(new URL(`/?error=${error}`, request.url));
  }

  if (connected) {
    return NextResponse.redirect(new URL('/?connected=true', request.url));
  }

  return NextResponse.redirect(new URL('/', request.url));
}
