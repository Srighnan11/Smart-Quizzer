import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, XCircle, Home } from "lucide-react";

interface Question {
  question_text: string;
  user_answer: string;
  correct_answer: string;
  is_correct: boolean;
  difficulty: string;
}

const Results = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [questions, setQuestions] = useState<Question[]>([]);

  useEffect(() => {
    const fetchResults = async () => {
      const { data: sessionData, error: sessionError } = await supabase
        .from("quiz_sessions")
        .select("*")
        .eq("id", sessionId)
        .single();

      if (sessionError || !sessionData) {
        toast({
          title: "Error",
          description: "Results not found",
          variant: "destructive",
        });
        navigate("/");
        return;
      }

      const { data: questionsData, error: questionsError } = await supabase
        .from("questions")
        .select("*")
        .eq("session_id", sessionId)
        .order("created_at");

      if (questionsError) {
        toast({
          title: "Error loading questions",
          description: questionsError.message,
          variant: "destructive",
        });
      }

      setSession(sessionData);
      setQuestions(questionsData || []);
      setLoading(false);
    };

    fetchResults();
  }, [sessionId, navigate, toast]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p>Loading results...</p>
      </div>
    );
  }

  const percentage = session ? Math.round((session.score / session.total_questions) * 100) : 0;

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="container mx-auto max-w-3xl">
        <Card className="mb-6">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl mb-2">Quiz Completed!</CardTitle>
            <div className="text-6xl font-bold text-primary">
              {percentage}%
            </div>
            <p className="text-lg text-muted-foreground mt-2">
              {session?.score} out of {session?.total_questions} correct
            </p>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button onClick={() => navigate("/")} size="lg">
              <Home className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <h2 className="text-2xl font-semibold mb-4">Review Your Answers</h2>
          {questions.map((question, index) => (
            <Card key={index} className={question.is_correct ? "border-difficulty-easy" : "border-difficulty-hard"}>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <CardTitle className="text-base flex-1">
                    {index + 1}. {question.question_text}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-medium px-2 py-1 rounded ${
                        question.difficulty === "Easy"
                          ? "bg-difficulty-easy/10 text-difficulty-easy"
                          : question.difficulty === "Medium"
                          ? "bg-difficulty-medium/10 text-difficulty-medium"
                          : "bg-difficulty-hard/10 text-difficulty-hard"
                      }`}
                    >
                      {question.difficulty}
                    </span>
                    {question.is_correct ? (
                      <CheckCircle2 className="h-6 w-6 text-difficulty-easy" />
                    ) : (
                      <XCircle className="h-6 w-6 text-difficulty-hard" />
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Your Answer:</p>
                  <p className={question.is_correct ? "text-difficulty-easy" : "text-difficulty-hard"}>
                    {question.user_answer}
                  </p>
                </div>
                {!question.is_correct && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Correct Answer:</p>
                    <p className="text-difficulty-easy">{question.correct_answer}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Results;