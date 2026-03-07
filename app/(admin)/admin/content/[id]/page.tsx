import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ContentForm } from "./content-form";

export default async function ContentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (id === "new") {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild className="h-8 w-8">
            <Link href="/admin/content"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <h1 className="text-xl font-semibold text-neutral-900">New Content</h1>
        </div>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Create content</CardTitle>
          </CardHeader>
          <CardContent>
            <ContentForm />
          </CardContent>
        </Card>
      </div>
    );
  }

  const supabase = await createClient();
  const { data: content } = await supabase.from("content").select("*").eq("id", id).single();
  if (!content) notFound();

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild className="h-8 w-8">
          <Link href="/admin/content"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <h1 className="text-xl font-semibold text-neutral-900">{content.title}</h1>
      </div>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Edit content</CardTitle>
        </CardHeader>
        <CardContent>
          <ContentForm content={content} />
        </CardContent>
      </Card>
    </div>
  );
}
